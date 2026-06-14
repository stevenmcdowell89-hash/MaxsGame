// ---------------------------------------------------------------------------
// EnergyView: the field-glow layer — "where the GRID is energised".
//
// It draws the EnergyField's `generated` strength (the raw energy radiated by
// the sources), NOT the post-drain `available`. Keeping towers' consumption out
// of this layer is deliberate: the field reads purely as energy and never
// dims/flickers as you place towers. A tower's draw is shown on its own amber
// channel (the per-piece intake node + the on-select footprint); brownouts show
// red on the tower. So the three things stay visually separate and legible.
//
// Look: a cool->hot heat map (distinct hue per strength tier so each reads on
// its own), a soft halo at each source centre, and a gentle breathing pulse so
// it reads as live energy. A single Graphics above the tiles, below entities;
// the scene calls
// redraw() whenever the sources change (a conduit placed/sold) and toggles it
// off in build mode (where the green/red placement overlay takes over).
// ---------------------------------------------------------------------------

import { ISO, DEPTH } from '../data/game.js';
import { ENERGY } from '../data/energy.js';

export class EnergyView {
  constructor(scene, grid, field) {
    this.scene = scene;
    this.grid = grid;
    this.field = field;

    this.g = scene.add.graphics();
    this.g.setDepth(DEPTH.tiles + 500); // above tiles, below entities/overlays

    // Breathing pulse: tween the layer's alpha so the field feels alive.
    this.scene.tweens.add({
      targets: this.g,
      alpha: { from: ENERGY.field.pulseLo, to: ENERGY.field.pulseHi },
      duration: ENERGY.field.pulseMs,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.redraw();
  }

  setVisible(v) {
    this.g.setVisible(v);
  }

  redraw() {
    const g = this.g;
    g.clear();

    const w = ISO.tileWidth;
    const h = ISO.tileHeight;
    const F = ENERGY.field;

    // Soft emitter halo at each source centre — sources visibly radiate energy.
    for (const s of this.field.sources) {
      const pos = this.grid.toScreen(s.c, s.r);
      g.fillStyle(F.sourceColor, F.sourceGlowA * 0.5);
      g.fillCircle(pos.x, pos.y, F.sourceGlowR);
      g.fillStyle(F.sourceColor, F.sourceGlowA);
      g.fillCircle(pos.x, pos.y, F.sourceGlowR * 0.55);
    }

    // Banded field fill (generated strength). No edge strokes — they used to
    // read like tile borders; soft additive fills read as glow instead.
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
    this.g.destroy();
  }
}
