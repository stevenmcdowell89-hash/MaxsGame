// ---------------------------------------------------------------------------
// Energy system tuning — the ONE place to balance the power layer.
//
// Money (data/towers.js `cost`) stays the "buy" currency. Energy is a separate
// placement-and-operation constraint layered on top: it governs WHERE and HOW
// MANY pieces can run, without ever touching a tower's stats.
//
// Two independent layers (see systems/EnergyField.js):
//
//   WHERE — the generated field. Every source emits a strength that falls off
//   with Chebyshev distance: generated[tile] = MAX over sources of
//   (output - distance), clamped at 0 (MAX, not sum, so sources don't stack).
//   A piece needs generated[its tile] >= its place-tier to be built/run:
//   tier-1 needs 1, tier-2 needs 2, tier-3 needs 3, a conduit needs 1.
//
//   HOW MANY — the footprint. Each placed piece RESERVES a set of cells by
//   tier; reserved cells can't be reused, so bigger pieces need more spacing:
//     tier 1  -> its own tile only  (reserves nothing extra -> pack freely)
//     tier 2  -> the 4 orthogonal neighbours (compass points)
//     tier 3  -> all 8 surrounding cells
//     conduit -> its own tile only, so the high-energy ring it creates stays
//                free to build on (a conduit exists to POWER its neighbours)
//   The visuals (flow / footprint ghost / select) draw exactly these cells.
//
// A conduit is also a source, so it extends the generated field outward — but
// it must be planted on tier-1 energy (generated >= 1), so you expand FROM your
// existing field, never in the void.
//
// Everything here is plain data — this file imports nothing from the app.
// ---------------------------------------------------------------------------

export const ENERGY = {
  // Source outputs (strength at distance 0; steps down one per tile outward).
  //   - coreOutput 5: a generous home zone (tier-3 within 2 tiles, tier-2
  //     within 3, tier-1 within 4) so turtling is viable.
  //   - conduitOutput 4: shorter than the core, so expanding costs gold and
  //     covers less per step.
  coreOutput: 5,
  conduitOutput: 4,

  // Generated strength a CONDUIT needs under it to be placed (it must connect
  // to the existing field rather than appear in dead space).
  conduitPlaceTier: 1,

  // Footprint offsets a piece reserves around itself, by kind. Its own tile is
  // always reserved via the grid; these are the EXTRA cells it blocks/draws.
  footprint: {
    tier1: [],   // own tile only
    conduit: [], // own tile only — keep its powered ring buildable
    tier2: [     // 4 orthogonal "compass" neighbours
      { dc: 0, dr: -1 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }, { dc: 1, dr: 0 },
    ],
    tier3: [     // all 8 surrounding cells
      { dc: -1, dr: -1 }, { dc: 0, dr: -1 }, { dc: 1, dr: -1 },
      { dc: -1, dr: 0 },                     { dc: 1, dr: 0 },
      { dc: -1, dr: 1 },  { dc: 0, dr: 1 },  { dc: 1, dr: 1 },
    ],
  },

  // Highest strength level the visuals band for (= max possible generated).
  maxLevel: 5,

  // ---- Visuals --------------------------------------------------------------
  // Three deliberately DISTINCT channels so nothing reads ambiguously:
  //   1. FIELD (heat map)        = the energy the GRID provides (generated).
  //   2. FLOW (white, animated)  = a tower drawing FROM the grid.
  //   3. WARN (red)              = a browned-out tower (lost its source).
  field: {
    // Heat ramp indexed by floored generated strength (0 draws nothing).
    // Distinct HUES (not just brightness) so a tier reads at a glance.
    bandColors: [0x000000, 0x2b5fd9, 0x18b6c4, 0x3fce5a, 0xf4d13a, 0xff7a2a],
    bandAlphas: [0,        0.34,     0.38,     0.42,     0.46,     0.52],
    // Soft emitter halo at each source centre so sources visibly radiate.
    sourceColor: 0x9bf0ff,
    sourceGlowR: 78,   // px radius of the source halo
    sourceGlowA: 0.14,
    // Gentle breathing pulse on the whole field (alpha lo..hi).
    pulseLo: 0.80,
    pulseHi: 1.0,
    pulseMs: 1600,
  },

  // Ambient, always-on indicator: a blue grid along the lines of the powered
  // region, TIERED by generated strength — faint at the tier-1 edge, strongest
  // at the source. Drawn with NORMAL blend (additive saturated to white on the
  // bright terrain, hiding the higher tiers), and tiered by BOTH opacity and
  // line width so strength reads clearly. A brightness/width band also sweeps
  // outward from the source through the lines (energy "pulsing" through).
  // Drawn as "blue lightning": a blue body line with a white-hot core on top.
  // Tiered by opacity AND width (edge bright-but-thin, source bold), and the
  // pulse flashes the white core as it sweeps outward.
  powerGlow: {
    color: 0x73d3ff,      // blue body
    coreColor: 0xeafaff,  // white-hot core
    // Per generated level (index = level): widened spread for clearer contrast —
    // edge dimmer (but not as faint as before), lower-mid down a touch, the
    // upper tiers and source kept strong.
    alphaByLevel: [0, 0.34, 0.50, 0.70, 0.88, 1.0],
    coreAlphaByLevel: [0, 0.12, 0.22, 0.34, 0.48, 0.64],
    widthByLevel: [0, 1.7, 2.1, 2.7, 3.4, 4.3],
    pulseAmp: 0.16,   // body opacity boost at the pulse front
    pulseWidth: 2.0,  // line-width boost (px) at the pulse front
    pulseCore: 0.38,  // white-core opacity boost at the front (the lightning flash)
    pulseBand: 1.3,   // band half-width, in tiers
    pulseMs: 2200,    // sweep period (source -> edge), then repeat
  },

  // Animated consumption flow: motes from each reserved tile into the tower.
  // Deliberately SLOW and SUBTLE (~30% opacity) — present but not distracting.
  // Rendered ADDITIVE white so the motes still read over any heat-map colour.
  flow: {
    dotColor: 0xffffff,     // white energy mote (additive)
    glowColor: 0xffe6a0,    // warm halo around each mote
    tendrilColor: 0xffd27a, // guide line along each draw path
    tendrilAlpha: 0.08,
    dotR: 4,                // mote core radius (px)
    dots: 1,                // motes in flight per draw path
    speedMs: 2200,          // ms for a mote to travel a path (slow)
    coreAlpha: 0.30,        // peak opacity of a mote core
    glowAlpha: 0.12,        // peak opacity of a mote halo
  },

  // Per-piece indicator node at the foot of each placed piece.
  indicator: {
    drawColor: 0xffd24a,   // a tower drawing from the grid (amber sink)
    sourceColor: 0x8be9ff, // a conduit feeding the grid (cyan)
  },

  // Placement-mode overlay (green = placeable here, red = blocked: no energy or
  // a neighbour's footprint is in the way) and the footprint ghost.
  overlay: {
    okColor: 0x49d49a, okAlpha: 0.30,
    badColor: 0xe06a5a, badAlpha: 0.22,
    drawColor: 0xffb24a,   // a tower's reserved footprint
    sourceColor: 0x8be9ff, // a conduit's reserved footprint
    footprintFill: 0.16,
    footprintLine: 0.7,
  },
};
