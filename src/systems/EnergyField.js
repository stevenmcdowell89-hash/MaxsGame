// ---------------------------------------------------------------------------
// EnergyField: the stateful energy model over the board.
//
// It owns two derived grids, recomputed whenever a piece is placed or removed:
//   - generated[c][r]: strength radiated by the sources (core + conduits),
//                      = MAX over sources of (output - Chebyshev distance), >= 0.
//   - available[c][r]: generated minus the drain of every nearby tower. This is
//                      the value that gates placement and brownouts. It can go
//                      negative (an over-drained tile); callers clamp for display.
//
// It holds no Phaser objects — purely spatial/logical state, like IsoGrid. The
// scene registers sources/consumers as pieces are built or sold, then calls
// recompute(). All tunables live in data/energy.js.
// ---------------------------------------------------------------------------

import { ENERGY } from '../data/energy.js';

export class EnergyField {
  constructor(grid) {
    this.grid = grid;
    this.cols = grid.cols;
    this.rows = grid.rows;

    this.sources = [];   // { c, r, output, core? }
    this.consumers = []; // { c, r, drain }

    this.generated = this.makeGrid();
    this.available = this.makeGrid();

    // The defended base/core is the primary, permanent energy source.
    const base = grid.baseCell;
    this.sources.push({ c: base.c, r: base.r, output: ENERGY.coreOutput, core: true });

    this.recompute();
  }

  makeGrid() {
    const g = new Array(this.cols);
    for (let c = 0; c < this.cols; c++) g[c] = new Array(this.rows).fill(0);
    return g;
  }

  cheby(c1, r1, c2, r2) {
    return Math.max(Math.abs(c1 - c2), Math.abs(r1 - r2));
  }

  // ---- mutation (scene calls these on build / sell) ---------------------

  addSource(c, r, output) {
    this.sources.push({ c, r, output });
  }

  removeSourceAt(c, r) {
    // Never remove the core source.
    this.sources = this.sources.filter((s) => s.core || s.c !== c || s.r !== r);
  }

  addConsumer(c, r, drain) {
    this.consumers.push({ c, r, drain });
  }

  removeConsumerAt(c, r) {
    this.consumers = this.consumers.filter((t) => t.c !== c || t.r !== r);
  }

  // ---- computation ------------------------------------------------------

  recompute() {
    const cols = this.cols;
    const rows = this.rows;

    // Generated: max contribution of any source, clamped at 0.
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        let best = 0;
        for (const s of this.sources) {
          const v = s.output - this.cheby(c, r, s.c, s.r);
          if (v > best) best = v;
        }
        this.generated[c][r] = best;
        this.available[c][r] = best;
      }
    }

    // Available: subtract each tower's drain across its 8-tile footprint.
    for (const t of this.consumers) {
      for (const o of ENERGY.drainOffsets) {
        const c = t.c + o.dc;
        const r = t.r + o.dr;
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
        this.available[c][r] -= t.drain;
      }
    }
  }

  // ---- queries ----------------------------------------------------------

  generatedAt(c, r) { return this.generated[c][r]; }
  availableAt(c, r) { return this.available[c][r]; }

  // Would a piece of the given tier be powered if placed on (c, r)? Sources
  // (tier 0) carry no power requirement; a tower needs available >= its tier.
  // A tower never drains its own tile, so the current available is exactly what
  // the placed tower would see.
  canPower(c, r, tier) {
    return (tier ?? 0) <= 0 || this.available[c][r] >= tier;
  }
}
