// ---------------------------------------------------------------------------
// BootScene: one-time setup. Generates placeholder textures, then hands off to
// the GameScene (with the HUDScene launched on top in parallel).
//
// ART MIGRATION NOTE: when real PNGs exist, `preload()` is where you load them
// (this.load.image('tower-blaster', 'assets/tower-blaster.png'), etc.) and you
// can delete the generatePlaceholderTextures() call. Everything downstream
// references the same texture keys, so nothing else changes.
// ---------------------------------------------------------------------------

import { generatePlaceholderTextures } from '../rendering/textures.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    // No external assets in v1 — textures are generated in create(). Real art
    // loads would go here later.
  }

  create() {
    generatePlaceholderTextures(this);
    this.scene.start('game');
    this.scene.launch('hud');
  }
}
