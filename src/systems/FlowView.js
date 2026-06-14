// ---------------------------------------------------------------------------
// FlowView: the "tower is drawing from the grid" animation.
//
// Every frame, for each powered ATTACKING tower, it streams bright amber motes
// from each energised neighbour tile INTO the tower, along a faint guide line.
// Motion + a hot amber colour make consumption read unmistakably as energy
// being PULLED OUT of the grid — clearly not part of the static field beneath.
//
// It's one Graphics, redrawn each frame from the live tower list + field, so it
// always reflects what's actually drawing. The scene hides it in build mode
// (where the placement overlay owns the board). Conduits feed the grid, so they
// don't draw — they're skipped here.
// ---------------------------------------------------------------------------

import { DEPTH } from '../data/game.js';
import { ENERGY } from '../data/energy.js';

export class FlowView {
  constructor(scene, grid, field) {
    this.scene = scene;
    this.grid = grid;
    this.field = field;
    this.g = scene.add.graphics();
    this.g.setDepth(DEPTH.tiles + 700); // over the field, under the entities
    this.g.setBlendMode(Phaser.BlendModes.ADD); // motes glow over any field colour
  }

  setVisible(v) {
    this.g.setVisible(v);
    if (!v) this.g.clear();
  }

  // time: ms (scene clock). towers: the scene's live piece list.
  update(time, towers) {
    const g = this.g;
    g.clear();
    const F = ENERGY.flow;
    const cycle = F.speedMs;

    for (const t of towers) {
      // Only attacking towers DRAW; conduits feed; browned-out towers don't pull.
      if (t.def.isSource || t.def.noAttack || !t.powered) continue;

      const bx = t.x;
      const by = t.y - 6; // converge on the tower's foot
      let idx = 0;

      for (const o of ENERGY.drainOffsets) {
        idx++;
        const c = t.cell.c + o.dc;
        const r = t.cell.r + o.dr;
        if (!this.grid.inBounds(c, r)) continue;
        if (this.field.generatedAt(c, r) <= 0) continue; // no energy here to pull

        const p = this.grid.toScreen(c, r);

        // Faint guide tendril along the draw path.
        g.lineStyle(2, F.tendrilColor, F.tendrilAlpha);
        g.lineBetween(p.x, p.y, bx, by);

        // Motes travelling tile -> tower, staggered per path so they don't march
        // in lockstep. Each fades in/out at the ends (sin envelope). A warm halo
        // plus a white core makes them glow distinctly over the heat-map field.
        const stagger = (idx * 0.37) % 1;
        for (let d = 0; d < F.dots; d++) {
          const ph = ((time / cycle) + stagger + d / F.dots) % 1;
          const x = Phaser.Math.Linear(p.x, bx, ph);
          const y = Phaser.Math.Linear(p.y, by, ph);
          const env = Math.sin(ph * Math.PI); // 0 at ends, 1 mid-path
          g.fillStyle(F.glowColor, 0.25 * env);
          g.fillCircle(x, y, F.dotR * 2.3);
          g.fillStyle(F.dotColor, 0.35 + 0.6 * env);
          g.fillCircle(x, y, F.dotR);
        }
      }
    }
  }

  destroy() {
    this.g.destroy();
  }
}
