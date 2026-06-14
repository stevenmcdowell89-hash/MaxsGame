// ---------------------------------------------------------------------------
// Energy system tuning — the ONE place to balance the power layer.
//
// Money (data/towers.js `cost`) stays the "buy" currency. Energy is a separate
// placement-and-operation constraint layered on top: it governs WHERE and HOW
// MANY towers can run, without ever touching a tower's stats.
//
// Model (see systems/EnergyField.js for the math):
//   - Every source emits a strength that falls off with grid distance, using
//     Chebyshev distance for a rounded field. generated[tile] = MAX over all
//     sources of (source.output - distance), clamped at 0. MAX (not sum) keeps
//     overlapping sources from stacking into runaway values.
//   - The defended base/core is the primary, permanent source (coreOutput).
//   - A CONDUIT is a placeable, non-attacking source (conduitOutput): the
//     player's main "expand your power" action.
//   - Each placed tower DRAINS its 8 neighbouring tiles (drainByTier), so
//     available[tile] = generated[tile] - sum of nearby drains. A tower needs
//     available >= its tier to be placed AND to keep firing; if a neighbour
//     pushes it below, it browns out (goes INACTIVE).
//
// Everything here is plain data — this file imports nothing from the app.
// ---------------------------------------------------------------------------

export const ENERGY = {
  // Source outputs (strength emitted at distance 0). The field steps down one
  // per tile of Chebyshev distance: e.g. core 5 -> 5,4,3,2,1,0 outward.
  //
  // Balanced for a real TURTLE-vs-EXPAND choice:
  //   - coreOutput 5 gives a generous home zone: tier-3 within 2 tiles, tier-2
  //     within 3, tier-1 within 4. You can mount a strong defence without ever
  //     placing a conduit (turtle).
  //   - conduitOutput 4 is deliberately SHORTER than the core: a conduit only
  //     reaches tier-3 on its 8 adjacent tiles, tier-2 within 2, tier-1 within
  //     3. So spreading out costs gold AND covers less per step than staying
  //     home — expansion is an investment, not a free upgrade.
  coreOutput: 5,
  conduitOutput: 4,

  // How much strength each placed tower removes from every tile in its drain
  // footprint, keyed by the tower's tier. Higher tier = hungrier.
  //   - Tuned so two TIER-3 towers cannot sit adjacent (each would drag the
  //     other below its tier-3 requirement), while TIER-1 towers (low draw)
  //     can cluster fairly densely in a well-powered zone.
  drainByTier: { 1: 1, 2: 2, 3: 3 },

  // The drain footprint: the 8 tiles adjacent to a tower (Chebyshev radius 1).
  // A tower never drains its own tile — only clustering with neighbours bites.
  drainOffsets: [
    { dc: -1, dr: -1 }, { dc: 0, dr: -1 }, { dc: 1, dr: -1 },
    { dc: -1, dr: 0 },                     { dc: 1, dr: 0 },
    { dc: -1, dr: 1 },  { dc: 0, dr: 1 },  { dc: 1, dr: 1 },
  ],

  // Highest strength level the visuals band for (= max possible generated).
  maxLevel: 5,

  // ---- Visuals --------------------------------------------------------------
  // Three deliberately DISTINCT visual channels so nothing reads ambiguously:
  //   1. FIELD (heat-map) = the energy the GRID provides. This is the
  //      `generated` field, colour-coded by strength with a clear cool->hot
  //      ramp (blue=1 ... orange=5) so each tier is identifiable on its own,
  //      not just by comparison. It only changes when sources change.
  //   2. FLOW (amber, animated) = a tower pulling FROM the grid: dots stream
  //      from each energised neighbour tile INTO the tower every frame, so
  //      consumption is unmistakably moving energy, not part of the static grid.
  //   3. WARN (red) = a browned-out tower that can't get enough (see Tower).
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

  // Animated consumption flow: motes travelling from each drained tile into the
  // tower. This is the "tower is drawing from the grid" readout. Rendered
  // ADDITIVE white so the motes pop over ANY heat-map colour (they must not be
  // mistaken for the field itself), with a warm-white guide tendril.
  flow: {
    dotColor: 0xffffff,     // bright white energy mote (additive)
    glowColor: 0xffe6a0,    // warm halo around each mote
    tendrilColor: 0xffd27a, // guide line along each draw path
    tendrilAlpha: 0.30,
    dotR: 4.5,              // mote core radius (px)
    dots: 2,                // motes in flight per draw path
    speedMs: 820,           // ms for a mote to travel a path
  },

  // Per-piece indicator node at the foot of each placed piece.
  indicator: {
    drawColor: 0xffd24a,   // a tower drawing from the grid (amber sink)
    sourceColor: 0x8be9ff, // a conduit feeding the grid (cyan)
  },

  // Placement-mode overlay (green = the selected piece would be powered here,
  // red = it would be browned out) and the drain/boost footprint ghost.
  overlay: {
    okColor: 0x49d49a, okAlpha: 0.30,
    badColor: 0xe06a5a, badAlpha: 0.22,
    drainColor: 0xffb24a,  // tower drain footprint
    sourceColor: 0x8be9ff, // conduit boost footprint
    footprintFill: 0.16,
    footprintLine: 0.7,
  },
};
