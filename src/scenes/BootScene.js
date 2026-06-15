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
import { TOWER_LIST } from '../data/towers.js';
import { ENEMY_LIST } from '../data/enemies.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    // Real hand-drawn ground texture: the iso tiles are generated from it at
    // boot (see rendering/textures.js). Loaded under a source key; if it's
    // missing the tiles fall back to the procedural flat-colour diamonds.
    this.load.image('terrain-cracked', 'assets/terrain/cracked-earth.png');

    // Load real hand-drawn art for any tower/enemy that declares an `asset`.
    // It loads under the same texture key the placeholder would use, so the
    // rest of the game is unaffected. Anything without an `asset` falls back to
    // a generated placeholder in create().
    for (const def of [...TOWER_LIST, ...ENEMY_LIST]) {
      if (def.asset) this.load.image(def.textureKey, def.asset);
    }
  }

  create() {
    generatePlaceholderTextures(this);
    this.scene.start('game');
    this.scene.launch('hud');
  }
}
