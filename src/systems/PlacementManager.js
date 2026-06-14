// ---------------------------------------------------------------------------
// PlacementManager: handles the "build a tower" interaction.
//
//   - Toggle build mode on/off (driven by the HUD build button).
//   - While active, highlight the cell under the pointer (valid = green,
//     invalid = red) and show the selected tower's range.
//   - On tap, validate (buildable + affordable) and ask the scene to build.
//
// It draws its own highlight graphics but does not create towers itself — it
// calls scene.tryBuildTower(cell, towerDef) so the scene remains the owner of
// entities and economy.
// ---------------------------------------------------------------------------

import { PALETTE, DEPTH, ISO } from '../data/game.js';

export class PlacementManager {
  constructor(scene, grid) {
    this.scene = scene;
    this.grid = grid;
    this.active = false;
    this.towerDef = null;

    // Highlight diamond drawn over the hovered cell.
    this.highlight = scene.add.graphics();
    this.highlight.setDepth(DEPTH.entityBase - 1);
    this.highlight.setVisible(false);

    // Range preview circle.
    this.rangePreview = scene.add.graphics();
    this.rangePreview.setDepth(DEPTH.entityBase - 1);
    this.rangePreview.setVisible(false);
  }

  setMode(active, towerDef) {
    this.active = active;
    this.towerDef = towerDef || this.towerDef;
    this.highlight.setVisible(false);
    this.rangePreview.setVisible(false);
  }

  // Called from the scene's pointer move handler with camera world coords.
  onPointerMove(worldX, worldY) {
    if (!this.active) return;
    const cell = this.grid.cellAt(worldX, worldY);
    if (!cell) {
      this.highlight.setVisible(false);
      this.rangePreview.setVisible(false);
      return;
    }
    this.drawHighlight(cell);
  }

  drawHighlight(cell) {
    const pos = this.grid.toScreen(cell.c, cell.r);
    const ok = this.grid.isBuildable(cell.c, cell.r) &&
      this.scene.canAfford(this.towerDef.cost);
    const color = ok ? PALETTE.tileBuildOk : PALETTE.tileBuildBad;

    const w = ISO.tileWidth;
    const h = ISO.tileHeight;
    this.highlight.clear();
    this.highlight.fillStyle(color, 0.35);
    this.highlight.lineStyle(2, color, 0.9);
    this.highlight.beginPath();
    this.highlight.moveTo(pos.x, pos.y - h / 2);
    this.highlight.lineTo(pos.x + w / 2, pos.y);
    this.highlight.lineTo(pos.x, pos.y + h / 2);
    this.highlight.lineTo(pos.x - w / 2, pos.y);
    this.highlight.closePath();
    this.highlight.fillPath();
    this.highlight.strokePath();
    this.highlight.setVisible(true);

    // Range preview (screen-space circle; gentle iso reads fine as a circle).
    this.rangePreview.clear();
    if (ok) {
      this.rangePreview.lineStyle(2, color, 0.5);
      this.rangePreview.fillStyle(color, 0.08);
      this.rangePreview.fillCircle(pos.x, pos.y, this.scene.rangePxFor(this.towerDef));
      this.rangePreview.strokeCircle(pos.x, pos.y, this.scene.rangePxFor(this.towerDef));
      this.rangePreview.setVisible(true);
    } else {
      this.rangePreview.setVisible(false);
    }
  }

  // Called from the scene's pointer-up handler with camera world coords. Returns
  // true if it consumed the tap (a build was attempted) so the scene can skip
  // other handling.
  onPointerUp(worldX, worldY) {
    if (!this.active) return false;
    const cell = this.grid.cellAt(worldX, worldY);
    if (!cell) return false;
    this.scene.tryBuildTower(cell, this.towerDef);
    // Re-draw highlight to reflect new occupancy / affordability.
    this.drawHighlight(cell);
    return true;
  }
}
