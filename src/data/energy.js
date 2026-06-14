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
  //   1. FIELD  (cyan, additive glow) = the energy the GRID provides. This is
  //      the `generated` field — it only changes when sources change, so it
  //      reads purely as "where the grid is energised", never muddied by towers.
  //   2. DRAW   (amber) = a tower pulling FROM the grid: an always-on intake
  //      node at each powered tower, plus its full footprint shown on select.
  //   3. WARN   (red)  = a browned-out tower that can't get enough (see Tower).
  field: {
    // Cyan ramp, indexed by floored generated strength (0 draws nothing).
    bandColors: [0x000000, 0x1c5f80, 0x2f86b0, 0x49b6e0, 0x79d8ff, 0xc4f2ff],
    bandAlphas: [0,        0.10,     0.14,     0.19,     0.25,     0.32],
    // Soft emitter glow drawn at each source centre so sources visibly radiate.
    sourceColor: 0x9bf0ff,
    sourceGlowR: 86,   // px radius of the source halo
    sourceGlowA: 0.22,
    // Gentle breathing pulse on the whole field (alpha lo..hi), so it reads as
    // live energy rather than flat paint.
    pulseLo: 0.82,
    pulseHi: 1.0,
    pulseMs: 1600,
  },

  // Per-piece indicator node at the foot of each placed piece.
  indicator: {
    drawColor: 0xffb24a,   // a tower drawing from the grid (amber)
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
