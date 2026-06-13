// ---------------------------------------------------------------------------
// Single entry point. Configures the Phaser game and registers scenes.
//
// `Phaser` is the only global we rely on (loaded from the CDN <script> in
// index.html). Everything else is explicit ES module imports, so migrating to
// a Vite + TypeScript build later is mechanical: install phaser, `import Phaser
// from 'phaser'`, rename files to .ts, done.
// ---------------------------------------------------------------------------

import { GAME, PALETTE } from './data/game.js';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HUDScene } from './scenes/HUDScene.js';
import { EventBus } from './core/EventBus.js';

const config = {
  type: Phaser.WEBGL, // hard requirement: WebGL renderer for headroom later
  parent: 'game-root',
  backgroundColor: PALETTE.bgCss,
  scale: {
    mode: Phaser.Scale.FIT,            // fit logical size into the screen
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME.width,
    height: GAME.height,
  },
  render: {
    antialias: true,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  input: {
    activePointers: 3, // multi-touch headroom for a tablet
  },
  scene: [BootScene, GameScene, HUDScene],
};

const game = new Phaser.Game(config);

// Debug handles for the browser console (and automated smoke tests). Not used
// by game logic — safe to remove. Handy when iterating with my son.
window.__game = game;
window.__bus = EventBus;
