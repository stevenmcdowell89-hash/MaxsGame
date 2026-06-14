// ---------------------------------------------------------------------------
// PlacementManager: handles the "build a piece" interaction (towers + conduit).
//
//   - Toggle build mode on/off (driven by the HUD build bar).
//   - While active it paints an energy-aware placement overlay over the board:
//       * every buildable tile is tinted GREEN if the selected piece would be
//         powered there (available strength >= its tier) or RED if it would be
//         browned out. Conduits (tier 0) are powered anywhere.
//       * the hovered cell gets a stronger highlight (also folding in buildable
//         + affordable) plus a range preview, and the piece's footprint ghost:
//         a tower shows the 8 tiles it will DRAIN, a conduit shows the tiles it
//         will BOOST.
//   - On tap it validates and asks the scene to build.
//
// It draws its own graphics but never creates pieces itself — it calls
// scene.tryBuildPiece(cell, def) so the scene stays the owner of entities,
// economy and the energy field.
// ---------------------------------------------------------------------------

import { PALETTE, DEPTH, ISO } from '../data/game.js';
import { ENERGY } from '../data/energy.js';

export class PlacementManager {
  constructor(scene, grid) {
    this.scene = scene;
    this.grid = grid;
    this.active = false;
    this.pieceDef = null;

    // Full-board green/red power overlay (lowest, under the hovered highlight).
    this.overlay = scene.add.graphics();
    this.overlay.setDepth(DEPTH.tiles + 600);
    this.overlay.setVisible(false);

    // Footprint ghost (drain / boost) for the hovered cell.
    this.ghost = scene.add.graphics();
    this.ghost.setDepth(DEPTH.tiles + 601);
    this.ghost.setVisible(false);

    // Highlight diamond drawn over the hovered cell.
    this.highlight = scene.add.graphics();
    this.highlight.setDepth(DEPTH.entityBase - 1);
    this.highlight.setVisible(false);

    // Range preview circle.
    this.rangePreview = scene.add.graphics();
    this.rangePreview.setDepth(DEPTH.entityBase - 1);
    this.rangePreview.setVisible(false);
  }

  setMode(active, pieceDef) {
    this.active = active;
    this.pieceDef = pieceDef || this.pieceDef;
    this.highlight.setVisible(false);
    this.rangePreview.setVisible(false);
    this.ghost.clear();
    this.ghost.setVisible(false);
    if (active) {
      this.drawOverlay();
    } else {
      this.overlay.clear();
      this.overlay.setVisible(false);
    }
  }

  // ----------------------------------------------------------- helpers ----

  // Trace a tile's iso diamond onto a Graphics (caller fills/strokes).
  diamondPath(g, pos) {
    const w = ISO.tileWidth;
    const h = ISO.tileHeight;
    g.beginPath();
    g.moveTo(pos.x, pos.y - h / 2);
    g.lineTo(pos.x + w / 2, pos.y);
    g.lineTo(pos.x, pos.y + h / 2);
    g.lineTo(pos.x - w / 2, pos.y);
    g.closePath();
  }

  // Would the selected piece be powered on this cell?
  poweredOn(c, r) {
    const def = this.pieceDef;
    return def.isSource || this.scene.energy.canPower(c, r, def.tier ?? 0);
  }

  // --------------------------------------------------------- overlays -----

  // Green/red power tint across every buildable tile. Redrawn whenever the field
  // changes (refreshOverlay) so consumption/expansion shows live while building.
  drawOverlay() {
    const g = this.overlay;
    g.clear();
    if (!this.active || !this.pieceDef) {
      g.setVisible(false);
      return;
    }
    const { okColor, okAlpha, badColor, badAlpha } = ENERGY.overlay;
    for (let r = 0; r < this.grid.rows; r++) {
      for (let c = 0; c < this.grid.cols; c++) {
        if (!this.grid.isBuildable(c, r)) continue;
        const ok = this.poweredOn(c, r);
        const pos = this.grid.toScreen(c, r);
        g.fillStyle(ok ? okColor : badColor, ok ? okAlpha : badAlpha);
        this.diamondPath(g, pos);
        g.fillPath();
      }
    }
    g.setVisible(true);
  }

  refreshOverlay() {
    if (this.active) this.drawOverlay();
  }

  // Outline the tiles the hovered piece will affect: a tower's 8-tile drain
  // footprint, or a conduit's boost radius (where it raises generated strength).
  drawFootprint(cell) {
    const g = this.ghost;
    g.clear();
    const def = this.pieceDef;
    const { drainColor, sourceColor, footprintFill, footprintLine } = ENERGY.overlay;

    const cells = [];
    if (def.isSource) {
      // The conduit raises strength out to (output - 1) tiles (Chebyshev).
      const reach = Math.max(0, ENERGY.conduitOutput - 1);
      for (let dr = -reach; dr <= reach; dr++) {
        for (let dc = -reach; dc <= reach; dc++) {
          if (dc === 0 && dr === 0) continue;
          const c = cell.c + dc;
          const r = cell.r + dr;
          if (this.grid.inBounds(c, r)) cells.push({ c, r });
        }
      }
    } else {
      for (const o of ENERGY.drainOffsets) {
        const c = cell.c + o.dc;
        const r = cell.r + o.dr;
        if (this.grid.inBounds(c, r)) cells.push({ c, r });
      }
    }

    const color = def.isSource ? sourceColor : drainColor;
    for (const cc of cells) {
      const pos = this.grid.toScreen(cc.c, cc.r);
      g.fillStyle(color, footprintFill);
      g.lineStyle(2, color, footprintLine);
      this.diamondPath(g, pos);
      g.fillPath();
      g.strokePath();
    }
    g.setVisible(true);
  }

  // Strong highlight on the hovered cell (buildable + affordable + powered).
  drawHighlight(cell) {
    const pos = this.grid.toScreen(cell.c, cell.r);
    const ok = this.grid.isBuildable(cell.c, cell.r) &&
      this.scene.canAfford(this.pieceDef.cost) &&
      this.poweredOn(cell.c, cell.r);
    const color = ok ? PALETTE.tileBuildOk : PALETTE.tileBuildBad;

    this.highlight.clear();
    this.highlight.fillStyle(color, 0.35);
    this.highlight.lineStyle(2, color, 0.9);
    this.diamondPath(this.highlight, pos);
    this.highlight.fillPath();
    this.highlight.strokePath();
    this.highlight.setVisible(true);

    // Range preview (attacking pieces only; conduits have no range).
    this.rangePreview.clear();
    if (ok && this.pieceDef.range) {
      const rpx = this.scene.rangePxFor(this.pieceDef);
      this.rangePreview.lineStyle(2, color, 0.5);
      this.rangePreview.fillStyle(color, 0.08);
      this.rangePreview.fillCircle(pos.x, pos.y, rpx);
      this.rangePreview.strokeCircle(pos.x, pos.y, rpx);
      this.rangePreview.setVisible(true);
    } else {
      this.rangePreview.setVisible(false);
    }
  }

  // ----------------------------------------------------------- input ------

  // Called from the scene's pointer move handler with camera world coords.
  onPointerMove(worldX, worldY) {
    if (!this.active) return;
    const cell = this.grid.cellAt(worldX, worldY);
    if (!cell) {
      this.highlight.setVisible(false);
      this.rangePreview.setVisible(false);
      this.ghost.clear();
      this.ghost.setVisible(false);
      return;
    }
    this.drawHighlight(cell);
    this.drawFootprint(cell);
  }

  // Called from the scene's pointer-up handler with camera world coords. Returns
  // true if it consumed the tap (a build was attempted) so the scene can skip
  // other handling.
  onPointerUp(worldX, worldY) {
    if (!this.active) return false;
    const cell = this.grid.cellAt(worldX, worldY);
    if (!cell) return false;
    this.scene.tryBuildPiece(cell, this.pieceDef);
    // Re-draw to reflect new occupancy / affordability / field (the scene also
    // calls refreshOverlay via refreshEnergy, but the hovered cell updates here).
    this.drawHighlight(cell);
    this.drawFootprint(cell);
    return true;
  }
}
