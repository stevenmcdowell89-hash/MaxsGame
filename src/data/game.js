// ---------------------------------------------------------------------------
// Global game tuning + shared constants.
//
// Everything here is "content / config", not logic. Tweak freely. Nothing in
// this file should import from systems, scenes, or entities (data is a leaf).
// ---------------------------------------------------------------------------

export const GAME = {
  // Logical resolution. The Scale manager FITs this into the device screen,
  // so on a tablet it letterboxes to landscape and stays crisp.
  width: 1280,
  height: 720,

  // Economy / lives for the player.
  startingLives: 20,
  startingGold: 100,

  // Fraction of a tower's build cost refunded when it is sold.
  sellRefund: 0.5,
};

// Isometric tile dimensions (2:1 "gentle" isometric). Used by the renderer and
// the grid math. If you swap in real art, keep art authored to this footprint.
export const ISO = {
  tileWidth: 128,
  tileHeight: 64,
};

// Central colour palette so the placeholder art + UI stay coherent and a future
// restyle is a one-file change.
export const PALETTE = {
  background: 0x171423,
  bgCss: '#171423',

  tileGround: 0x2e2a44,
  tileGroundEdge: 0x3b3658,
  tilePath: 0x4a4368,
  tilePathEdge: 0x5a5280,
  tileBuildOk: 0x49d49a,
  tileBuildBad: 0xe06a5a,

  hudPanel: 0x100e1a,
  hudText: '#f2eefb',
  hudAccent: '#8be9ff',
  gold: '#ffd66b',
  lives: '#ff8a7a',

  hpBack: 0x000000,
  hpFill: 0x6cf2a0,
  hpLow: 0xff6b6b,
};

// Depth bands keep render ordering predictable as the screen gets busy. Tiles
// sit far behind; everything else is depth-sorted by its screen-Y at runtime.
export const DEPTH = {
  tiles: 0,
  // entities use their screen Y (~0..720) offset by this so they always beat tiles
  entityBase: 1000,
  // projectiles/effects ride slightly above their owner
  effectBias: 5,
  ui: 100000,
};
