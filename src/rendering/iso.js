// ---------------------------------------------------------------------------
// Pure isometric projection math. No Phaser objects, no state — just the
// coordinate transforms between grid space (c, r) and screen space (x, y).
//
// We use a 2:1 "gentle" isometric: a tile is twice as wide as it is tall.
// ---------------------------------------------------------------------------

export function createIso(tileWidth, tileHeight, originX = 0, originY = 0) {
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;

  // Distance on screen between two orthogonally adjacent tile centres. Used to
  // convert tile-based speeds/ranges into pixels so gameplay reads consistently.
  const tileStep = Math.hypot(halfW, halfH);

  return {
    tileWidth,
    tileHeight,
    halfW,
    halfH,
    originX,
    originY,
    tileStep,

    // Grid cell -> screen position (centre of the tile diamond).
    toScreen(c, r) {
      return {
        x: this.originX + (c - r) * halfW,
        y: this.originY + (c + r) * halfH,
      };
    },

    // Screen position -> fractional grid cell (caller rounds as needed).
    toGrid(x, y) {
      const dx = (x - this.originX) / halfW;
      const dy = (y - this.originY) / halfH;
      return {
        c: (dx + dy) / 2,
        r: (dy - dx) / 2,
      };
    },

    // Convert a distance expressed in tiles to screen pixels.
    tilesToPixels(tiles) {
      return tiles * tileStep;
    },
  };
}
