// ---------------------------------------------------------------------------
// EnergyView: two layers over the terrain.
//
//   GLOW (always on, subtle): a blue line that pulses along the grid edges
//   bordering the powered region (cells with generated > 0). It's a slight "the
//   grid is live here" hint — additive, low alpha, gently breathing.
//
//   HEAT (inspect only): the full per-cell colour map (the cool->hot bands +
//   source halos). Hidden by default; the scene shows it while a piece is
//   selected, so the detailed energy picture is on-demand, not constant noise.
//
// Both are pure readouts of the EnergyField's `generated` field; the scene calls
// redraw() whenever the sources change, toggles the glow off in build mode, and
// toggles the heat on/off as pieces are selected/deselected.
// ---------------------------------------------------------------------------

import { ISO, DEPTH } from '../data/game.js';
import { ENERGY } from '../data/energy.js';

export class EnergyView {
  constructor(scene, grid, field) {
    this.scene = scene;
    this.grid = grid;
    this.field = field;

    // Inspect-only heat map (drawn under the glow).
    this.heat = scene.add.graphics();
    this.heat.setDepth(DEPTH.tiles + 498);
    this.heat.setVisible(false);

    // Always-on blue power glow (tiered + animated; redrawn each frame).
    this.glow = scene.add.graphics();
    this.glow.setDepth(DEPTH.tiles + 500);
    this.glow.setBlendMode(Phaser.BlendModes.ADD);

    this.redraw();
  }

  // Heat map on/off (a conduit/base is being inspected).
  setInspecting(v) { this.heat.setVisible(v); }

  // Whole view on/off (off during build mode, where the placement overlay owns
  // the board). Hiding also drops the heat map.
  setVisible(v) {
    this.glow.setVisible(v);
    if (!v) this.heat.setVisible(false);
  }

  powered(c, r) {
    return this.grid.inBounds(c, r) && this.field.generatedAt(c, r) > 0;
  }

  // Drive the flowing pulse (called each frame by the scene).
  update(time) {
    if (this.glow.visible) this.redrawGlow(time);
  }

  redraw() {
    this.redrawGlow(this.scene.time.now);
    this.redrawHeat();
  }

  // A brightness band that sweeps from the source tier (maxLevel) out to the
  // edge (0) and repeats, so the glow appears to pulse outward along the grid.
  pulseBoost(level, time) {
    const G = ENERGY.powerGlow;
    const span = ENERGY.maxLevel + 2 * G.pulseBand;
    const phase = (time % G.pulseMs) / G.pulseMs;
    const front = (ENERGY.maxLevel + G.pulseBand) - phase * span;
    const d = Math.abs(level - front);
    return d < G.pulseBand ? G.pulseAmp * (1 - d / G.pulseBand) : 0;
  }

  // Blue grid over the powered region: every powered cell's full diamond
  // outline glows, brighter the stronger the cell, plus the flowing pulse.
  redrawGlow(time) {
    const g = this.glow;
    g.clear();
    const w = ISO.tileWidth;
    const h = ISO.tileHeight;
    const G = ENERGY.powerGlow;

    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.cols; c++) {
        let lvl = Math.floor(this.field.generatedAt(c, r));
        if (lvl <= 0) continue;
        if (lvl > ENERGY.maxLevel) lvl = ENERGY.maxLevel;

        const a = Math.min(0.95, (G.alphaByLevel[lvl] ?? 0) + this.pulseBoost(lvl, time));
        g.lineStyle(G.width, G.color, a);
        const p = this.grid.toScreen(c, r);
        g.beginPath();
        g.moveTo(p.x, p.y - h / 2);
        g.lineTo(p.x + w / 2, p.y);
        g.lineTo(p.x, p.y + h / 2);
        g.lineTo(p.x - w / 2, p.y);
        g.closePath();
        g.strokePath();
      }
    }
  }

  redrawHeat() {
    const g = this.heat;
    g.clear();
    const w = ISO.tileWidth;
    const h = ISO.tileHeight;
    const F = ENERGY.field;

    // Soft halo at each source centre.
    for (const s of this.field.sources) {
      const pos = this.grid.toScreen(s.c, s.r);
      g.fillStyle(F.sourceColor, F.sourceGlowA * 0.5);
      g.fillCircle(pos.x, pos.y, F.sourceGlowR);
      g.fillStyle(F.sourceColor, F.sourceGlowA);
      g.fillCircle(pos.x, pos.y, F.sourceGlowR * 0.55);
    }

    // Banded heat map by generated strength.
    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.cols; c++) {
        let lvl = Math.floor(this.field.generatedAt(c, r));
        if (lvl <= 0) continue;
        if (lvl > ENERGY.maxLevel) lvl = ENERGY.maxLevel;
        const pos = this.grid.toScreen(c, r);
        g.fillStyle(F.bandColors[lvl], F.bandAlphas[lvl]);
        g.beginPath();
        g.moveTo(pos.x, pos.y - h / 2);
        g.lineTo(pos.x + w / 2, pos.y);
        g.lineTo(pos.x, pos.y + h / 2);
        g.lineTo(pos.x - w / 2, pos.y);
        g.closePath();
        g.fillPath();
      }
    }
  }

  destroy() {
    this.heat.destroy();
    this.glow.destroy();
  }
}
