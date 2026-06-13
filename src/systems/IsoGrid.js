// ---------------------------------------------------------------------------
// IsoGrid: stateful board built on top of the pure `iso` projection.
//
// Responsibilities:
//   - Know which cells are path vs. buildable.
//   - Track occupancy (where towers are placed).
//   - Convert between grid cells and screen positions (delegating math to iso).
//   - Centre the whole board within a given play-area rectangle.
//
// It holds no Phaser display objects — purely spatial/logical state.
// ---------------------------------------------------------------------------

import { createIso } from '../rendering/iso.js';
import { ISO } from '../data/game.js';

export class IsoGrid {
  constructor(level, playArea) {
    this.cols = level.cols;
    this.rows = level.rows;
    this.pathCells = level.path.map((p) => ({ ...p }));

    // Fast lookup set for "is this cell on the path".
    this.pathKeys = new Set(this.pathCells.map((p) => this.key(p.c, p.r)));
    // Occupied cells (towers).
    this.occupied = new Set();

    this.iso = createIso(ISO.tileWidth, ISO.tileHeight);
    this.centerWithin(playArea);

    // Precompute the path as screen-space waypoints for enemy movement.
    this.pathPoints = this.pathCells.map((p) => this.iso.toScreen(p.c, p.r));
  }

  key(c, r) {
    return `${c},${r}`;
  }

  // Adjust the iso origin so the board is centred inside the given rectangle.
  centerWithin(playArea) {
    // Compute the raw bounding box of all tile centres at origin (0,0).
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const p = this.iso.toScreen(c, r);
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
    }
    const boardCenterX = (minX + maxX) / 2;
    const boardCenterY = (minY + maxY) / 2;
    const targetX = playArea.x + playArea.width / 2;
    const targetY = playArea.y + playArea.height / 2;
    this.iso.originX = targetX - boardCenterX;
    this.iso.originY = targetY - boardCenterY;
  }

  inBounds(c, r) {
    return c >= 0 && c < this.cols && r >= 0 && r < this.rows;
  }

  isPath(c, r) {
    return this.pathKeys.has(this.key(c, r));
  }

  isOccupied(c, r) {
    return this.occupied.has(this.key(c, r));
  }

  isBuildable(c, r) {
    return this.inBounds(c, r) && !this.isPath(c, r) && !this.isOccupied(c, r);
  }

  occupy(c, r) {
    this.occupied.add(this.key(c, r));
  }

  release(c, r) {
    this.occupied.delete(this.key(c, r));
  }

  toScreen(c, r) {
    return this.iso.toScreen(c, r);
  }

  // Screen position -> nearest grid cell (rounded). Returns null if off-board.
  cellAt(x, y) {
    const g = this.iso.toGrid(x, y);
    const c = Math.round(g.c);
    const r = Math.round(g.r);
    if (!this.inBounds(c, r)) return null;
    return { c, r };
  }

  tilesToPixels(tiles) {
    return this.iso.tilesToPixels(tiles);
  }

  get spawnPoint() {
    return this.pathPoints[0];
  }

  get basePoint() {
    return this.pathPoints[this.pathPoints.length - 1];
  }

  get baseCell() {
    return this.pathCells[this.pathCells.length - 1];
  }
}
