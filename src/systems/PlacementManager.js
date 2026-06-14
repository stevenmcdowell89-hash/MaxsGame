// ---------------------------------------------------------------------------
// PlacementManager: the "build a piece" interaction (towers + conduit).
//
//   - Toggle build mode on/off (driven by the HUD build bar).
//   - While active it paints an energy-aware placement overlay over the board:
//       * every buildable tile is tinted GREEN if the selected piece can be
//         placed there (enough generated energy for its tier AND its footprint
//         is clear of other pieces' reservations) or RED if not.
//       * the hovered cell gets a stronger highlight (also folding in afford),
//         a range preview, and a FOOTPRINT ghost — the cells the piece will
//         reserve, by tier (a tier-1 reserves only its own tile, a tier-3 /
//         conduit the full 8 around it).
//   - On tap it asks the scene to build.
//
// It never creates pieces itself — it calls scene.tryBuildPiece(cell, def) so
// the scene stays the owner of entities, economy and the energy field.
// ---------------------------------------------------------------------------

import { PALETTE, DEPTH, ISO } from '../data/game.js';
import { ENERGY } from '../data/energy.js';

export class PlacementManager {
  constructor(scene, grid) {
    this.scene = scene;
    this.grid = grid;
    this.active = false;
    this.pieceDef = null;

    // Full-board green/red overlay (lowest, under the hovered highlight).
    this.overlay = scene.add.graphics();
    this.overlay.setDepth(DEPTH.tiles + 600);
    this.overlay.setVisible(false);

    // Footprint ghost for the hovered cell.
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

  canPlaceOn(c, r) {
    return this.scene.energy.canPlace(c, r, this.pieceDef);
  }

  // --------------------------------------------------------- overlays -----

  // Green/red placeability tint across every buildable tile. Redrawn whenever
  // the field changes (refreshOverlay) so it stays live while building.
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
        const ok = this.canPlaceOn(c, r);
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

  // Outline the cells the hovered piece will RESERVE (its footprint by tier),
  // plus its own tile. Amber for a tower, cyan for a conduit.
  drawFootprint(cell) {
    const g = this.ghost;
    g.clear();
    const def = this.pieceDef;
    const color = def.isSource ? ENERGY.overlay.sourceColor : ENERGY.overlay.drawColor;
    const { footprintFill, footprintLine } = ENERGY.overlay;

    const cells = [{ c: cell.c, r: cell.r }];
    for (const o of this.scene.energy.footprintFor(def)) {
      const c = cell.c + o.dc, r = cell.r + o.dr;
      if (this.grid.inBounds(c, r)) cells.push({ c, r });
    }

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

  // Strong highlight on the hovered cell (placeable + affordable).
  drawHighlight(cell) {
    const pos = this.grid.toScreen(cell.c, cell.r);
    const ok = this.grid.isBuildable(cell.c, cell.r) &&
      this.scene.canAfford(this.pieceDef.cost) &&
      this.canPlaceOn(cell.c, cell.r);
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

  // Returns true if it consumed the tap (a build was attempted).
  onPointerUp(worldX, worldY) {
    if (!this.active) return false;
    const cell = this.grid.cellAt(worldX, worldY);
    if (!cell) return false;
    this.scene.tryBuildPiece(cell, this.pieceDef);
    // The scene's refreshEnergy redraws the overlay; update the hovered cell.
    this.drawHighlight(cell);
    this.drawFootprint(cell);
    return true;
  }
}
