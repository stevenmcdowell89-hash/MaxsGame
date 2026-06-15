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

    // Always-on blue boundary glow, gently pulsing.
    this.glow = scene.add.graphics();
    this.glow.setDepth(DEPTH.tiles + 500);
    this.glow.setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: this.glow,
      alpha: { from: ENERGY.powerGlow.pulseLo, to: ENERGY.powerGlow.pulseHi },
      duration: ENERGY.powerGlow.pulseMs,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.redraw();
  }

  // Heat map on/off (a piece is being inspected).
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

  redraw() {
    this.redrawGlow();
    this.redrawHeat();
  }

  // Blue line along each powered cell's edge that borders an UN-powered cell —
  // i.e. the outline surrounding the live region.
  redrawGlow() {
    const g = this.glow;
    g.clear();
    const w = ISO.tileWidth;
    const h = ISO.tileHeight;
    const G = ENERGY.powerGlow;
    g.lineStyle(G.width, G.color, G.alpha);

    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.cols; c++) {
        if (!this.powered(c, r)) continue;
        const p = this.grid.toScreen(c, r);
        const tx = p.x,        ty = p.y - h / 2; // top vertex
        const rx = p.x + w / 2, ry = p.y;        // right vertex
        const bx = p.x,        by = p.y + h / 2; // bottom vertex
        const lx = p.x - w / 2, ly = p.y;        // left vertex
        // Each diamond edge faces one grid-orthogonal neighbour.
        if (!this.powered(c, r - 1)) g.lineBetween(tx, ty, rx, ry); // upper-right
        if (!this.powered(c + 1, r)) g.lineBetween(rx, ry, bx, by); // lower-right
        if (!this.powered(c, r + 1)) g.lineBetween(bx, by, lx, ly); // lower-left
        if (!this.powered(c - 1, r)) g.lineBetween(lx, ly, tx, ty); // upper-left
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
