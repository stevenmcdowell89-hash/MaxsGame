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
  // per tile of Chebyshev distance: e.g. core 4 -> 4,3,2,1,0 outward.
  coreOutput: 4,
  conduitOutput: 3,

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

  // Highest strength level the visuals band for (levels above clamp to this).
  maxLevel: 4,

  // Field glow layer (drawn translucent OVER the terrain). Indexed by the
  // floored available strength of a tile (0 = drawn nothing). Discrete bands
  // make the 3->2->1 tier boundaries legible without showing raw numbers.
  glow: {
    bandColors: [0x000000, 0x2f6d8c, 0x3f9fc8, 0x57c8f5, 0x9bf0ff],
    bandAlphas: [0,        0.12,     0.18,     0.26,     0.36],
  },

  // Placement-mode overlay (green = the selected piece would be powered here,
  // red = it would be browned out) and the drain/boost footprint ghost.
  overlay: {
    okColor: 0x49d49a, okAlpha: 0.30,
    badColor: 0xe06a5a, badAlpha: 0.22,
    drainColor: 0xffb24a,  // tower drain footprint
    sourceColor: 0x8be9ff, // conduit boost footprint
    footprintFill: 0.16,
    footprintLine: 0.6,
  },
};
