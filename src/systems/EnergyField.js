// ---------------------------------------------------------------------------
// EnergyField: the stateful energy model over the board. Pure spatial/logical
// state (no Phaser objects), recomputed whenever a piece is placed or removed.
//
// Two layers:
//   GENERATED — strength radiated by the sources (core + conduits):
//     generated[c][r] = MAX over sources of (output - Chebyshev distance), >= 0.
//     Gates WHERE each tier can build/run (generated >= the piece's place-tier)
//     and drives the field-glow heat map.
//   RESERVED  — the union of every placed piece's FOOTPRINT (the extra cells it
//     blocks, by tier — see data/energy.js). Gates HOW MANY / spacing: a piece
//     can't be built if its tile or any footprint cell is already reserved or
//     occupied, so bigger pieces need more room. Footprints never overlap by
//     construction, so removal is clean.
//
// All tunables (outputs, footprints, place-tiers) live in data/energy.js.
// ---------------------------------------------------------------------------

import { ENERGY } from '../data/energy.js';

export class EnergyField {
  constructor(grid) {
    this.grid = grid;
    this.cols = grid.cols;
    this.rows = grid.rows;

    this.sources = [];          // { c, r, output, core? }
    this.pieces = [];           // { c, r, def }
    this.generated = this.makeGrid();
    this.reserved = new Set();   // "c,r" keys covered by some piece's footprint
    this.sourceCells = new Set(); // "c,r" keys of placed conduits (feed, don't block)
    this.activeConduitCells = new Set(); // conduits still connected to the core

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

  key(c, r) { return `${c},${r}`; }
  cheby(c1, r1, c2, r2) { return Math.max(Math.abs(c1 - c2), Math.abs(r1 - r2)); }

  // ---- piece classification --------------------------------------------

  // The extra cells a piece reserves around itself (its own tile excluded —
  // that's handled by the grid's occupancy).
  footprintFor(def) {
    if (def.isSource) return ENERGY.footprint.conduit; // small, so it can power neighbours
    const t = def.tier ?? 0;
    if (t >= 3) return ENERGY.footprint.tier3;
    if (t === 2) return ENERGY.footprint.tier2;
    return ENERGY.footprint.tier1;                   // tier 1: own tile only
  }

  // Generated strength a piece needs under it to be placed / stay powered.
  placeTierFor(def) {
    if (def.isSource) return ENERGY.conduitPlaceTier;
    return def.tier ?? 0;
  }

  // ---- mutation (scene calls these on build / sell) ---------------------

  addPiece(c, r, def) {
    this.pieces.push({ c, r, def });
    if (def.isSource) this.sources.push({ c, r, output: ENERGY.conduitOutput });
  }

  removePieceAt(c, r) {
    this.pieces = this.pieces.filter((p) => p.c !== c || p.r !== r);
    // Drop a conduit's source too (never the permanent core).
    this.sources = this.sources.filter((s) => s.core || s.c !== c || s.r !== r);
  }

  // ---- computation ------------------------------------------------------

  recompute() {
    // 1) Connectivity flood from the core. A conduit only counts as a source if
    //    it's still connected back to the core through the powered field — i.e.
    //    some already-active source reaches its tile with >= conduitPlaceTier.
    //    This cascades: sell a conduit mid-chain and everything downstream of it
    //    goes dark.
    const active = [];
    const pending = [];
    for (const s of this.sources) (s.core ? active : pending).push(s);
    let changed = true;
    while (changed && pending.length) {
      changed = false;
      for (let i = pending.length - 1; i >= 0; i--) {
        const cd = pending[i];
        let best = 0;
        for (const s of active) {
          const v = s.output - this.cheby(cd.c, cd.r, s.c, s.r);
          if (v > best) best = v;
        }
        if (best >= ENERGY.conduitPlaceTier) {
          active.push(cd);
          pending.splice(i, 1);
          changed = true;
        }
      }
    }
    this.activeConduitCells = new Set();
    for (const s of active) if (!s.core) this.activeConduitCells.add(this.key(s.c, s.r));

    // 2) Generated field: max contribution of any ACTIVE source, clamped at 0.
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        let best = 0;
        for (const s of active) {
          const v = s.output - this.cheby(c, r, s.c, s.r);
          if (v > best) best = v;
        }
        this.generated[c][r] = best;
      }
    }

    // 3) Reserved set: union of every piece's footprint. Conduit tiles are also
    // tracked separately — a conduit FEEDS the grid, so a tower may build right
    // up against one (its footprint passes over the conduit tile).
    this.reserved = new Set();
    this.sourceCells = new Set();
    for (const p of this.pieces) {
      if (p.def.isSource) this.sourceCells.add(this.key(p.c, p.r));
      for (const o of this.footprintFor(p.def)) {
        const fc = p.c + o.dc;
        const fr = p.r + o.dr;
        if (this.grid.inBounds(fc, fr)) this.reserved.add(this.key(fc, fr));
      }
    }
  }

  // ---- queries ----------------------------------------------------------

  generatedAt(c, r) { return this.generated[c][r]; }
  isReserved(c, r) { return this.reserved.has(this.key(c, r)); }

  // Could `def` be placed on (c, r)? Needs enough generated energy for its
  // place-tier, and its tile + every footprint cell must be free (not reserved
  // by, nor sitting under, another piece). Off-board footprint cells are simply
  // not reserved. Assumes (c, r) itself is already known buildable (not path).
  canPlace(c, r, def) {
    if (this.generated[c][r] < this.placeTierFor(def)) return false;
    if (this.isReserved(c, r)) return false;
    for (const o of this.footprintFor(def)) {
      const fc = c + o.dc;
      const fr = r + o.dr;
      if (!this.grid.inBounds(fc, fr)) continue;
      if (this.isReserved(fc, fr)) return false;
      // A conduit feeds rather than competes, so a footprint may pass over it.
      if (this.grid.isOccupied(fc, fr) && !this.sourceCells.has(this.key(fc, fr))) return false;
    }
    return true;
  }

  // Is a placed piece still powered? A conduit is powered only while it's still
  // connected to the core (an active source); a tower needs its tile to carry
  // enough generated strength for its tier. Either browns out if the chain or a
  // source it relied on is broken.
  poweredFor(c, r, def) {
    if (def.isSource) return this.activeConduitCells.has(this.key(c, r));
    return this.generated[c][r] >= (def.tier ?? 0);
  }
}
