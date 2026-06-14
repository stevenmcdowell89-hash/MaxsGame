// ---------------------------------------------------------------------------
// EnergyView: the persistent field-glow layer.
//
// Draws the EnergyField's `available` strength as a translucent, banded glow
// over the terrain (brighter = stronger). Brightness is stepped per strength
// level (data/energy.js `glow`), so the tier boundaries read at a glance and
// over-packed clusters visibly darken as their available strength drops.
//
// It's a single Graphics object sitting above the tiles and below the entities;
// the scene calls redraw() whenever the field changes (a piece placed/sold).
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
    this.redraw();
  }

  redraw() {
    const g = this.g;
    g.clear();

    const w = ISO.tileWidth;
    const h = ISO.tileHeight;
    const { bandColors, bandAlphas } = ENERGY.glow;

    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.cols; c++) {
        let lvl = Math.floor(this.field.availableAt(c, r));
        if (lvl <= 0) continue;
        if (lvl > ENERGY.maxLevel) lvl = ENERGY.maxLevel;

        const pos = this.grid.toScreen(c, r);
        g.beginPath();
        g.moveTo(pos.x, pos.y - h / 2);
        g.lineTo(pos.x + w / 2, pos.y);
        g.lineTo(pos.x, pos.y + h / 2);
        g.lineTo(pos.x - w / 2, pos.y);
        g.closePath();

        g.fillStyle(bandColors[lvl], bandAlphas[lvl]);
        g.fillPath();
        // A faint band edge makes the discrete 3->2->1 boundaries pop.
        g.lineStyle(1.5, bandColors[lvl], bandAlphas[lvl] + 0.12);
        g.strokePath();
      }
    }
  }

  destroy() {
    this.g.destroy();
  }
}
