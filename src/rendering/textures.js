// ---------------------------------------------------------------------------
// Placeholder art generator.
//
// THE ART SEAM: every visual is a texture referenced by a string key. Here we
// procedurally generate simple shapes into those keys at boot. To switch to
// real hand-drawn art later, load transparent PNGs under the SAME keys in the
// BootScene preloader instead of generating them — no other code changes.
//
// Textures are generated from the data definitions (towers/enemies) so their
// colours stay data-driven too.
// ---------------------------------------------------------------------------

import { ISO, PALETTE } from '../data/game.js';
import { TOWER_LIST } from '../data/towers.js';
import { ENEMY_LIST } from '../data/enemies.js';

// Draw an isometric diamond tile (top face) with a subtle thickness, into a key.
function makeTileTexture(scene, key, faceColor, edgeColor) {
  const { tileWidth: w, tileHeight: h } = ISO;
  const thickness = 10;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // Side faces (thickness) for a slightly raised block look.
  g.fillStyle(edgeColor, 1);
  g.beginPath();
  g.moveTo(0, h / 2);
  g.lineTo(w / 2, h);
  g.lineTo(w / 2, h + thickness);
  g.lineTo(0, h / 2 + thickness);
  g.closePath();
  g.fillPath();
  g.beginPath();
  g.moveTo(w / 2, h);
  g.lineTo(w, h / 2);
  g.lineTo(w, h / 2 + thickness);
  g.lineTo(w / 2, h + thickness);
  g.closePath();
  g.fillPath();

  // Top face.
  g.fillStyle(faceColor, 1);
  g.lineStyle(2, edgeColor, 1);
  g.beginPath();
  g.moveTo(w / 2, 0);
  g.lineTo(w, h / 2);
  g.lineTo(w / 2, h);
  g.lineTo(0, h / 2);
  g.closePath();
  g.fillPath();
  g.strokePath();

  g.generateTexture(key, w, h + thickness);
  g.destroy();
}

// A small robot used for both towers and enemies, drawn at `scale`.
// Origin of the produced texture is top-left; entities set origin to bottom
// centre so the robot stands on its tile.
function makeBotTexture(scene, key, { color, accent, w, h }) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const cx = w / 2;

  // Soft contact shadow at the feet.
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(cx, h - 4, w * 0.7, 10);

  // Legs.
  g.fillStyle(0x2b2b3a, 1);
  g.fillRect(cx - w * 0.22, h * 0.62, w * 0.14, h * 0.3);
  g.fillRect(cx + w * 0.08, h * 0.62, w * 0.14, h * 0.3);

  // Body.
  const bodyW = w * 0.6;
  const bodyH = h * 0.4;
  const bodyX = cx - bodyW / 2;
  const bodyY = h * 0.28;
  g.fillStyle(color, 1);
  g.fillRoundedRect(bodyX, bodyY, bodyW, bodyH, 8);
  g.lineStyle(2, 0x161620, 1);
  g.strokeRoundedRect(bodyX, bodyY, bodyW, bodyH, 8);

  // Head.
  const headW = w * 0.46;
  const headH = h * 0.24;
  const headX = cx - headW / 2;
  const headY = h * 0.06;
  g.fillStyle(Phaser.Display.Color.IntegerToColor(color).lighten(8).color, 1);
  g.fillRoundedRect(headX, headY, headW, headH, 6);
  g.strokeRoundedRect(headX, headY, headW, headH, 6);

  // Glowing eye.
  g.fillStyle(accent, 1);
  g.fillCircle(cx, headY + headH / 2, headH * 0.28);
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(cx - 1, headY + headH / 2 - 1, headH * 0.12);

  // Antenna.
  g.lineStyle(2, 0x161620, 1);
  g.lineBetween(cx, headY, cx, headY - 8);
  g.fillStyle(accent, 1);
  g.fillCircle(cx, headY - 9, 3);

  g.generateTexture(key, w, h);
  g.destroy();
}

// A glowing projectile bolt.
function makeBoltTexture(scene, key, color) {
  const r = 9;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(color, 0.35);
  g.fillCircle(r, r, r);
  g.fillStyle(color, 1);
  g.fillCircle(r, r, r * 0.55);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(r, r, r * 0.25);
  g.generateTexture(key, r * 2, r * 2);
  g.destroy();
}

// A horizontal beam strip: full-white with a soft vertical falloff, so it can
// be stretched into a laser and tinted. (We render beams as stretched sprites
// rather than runtime Graphics — Graphics lines can drop out of the WebGL batch
// when a particle emitter is created in the same frame.)
function makeBeamTexture(scene, key) {
  const w = 16;
  const h = 32;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const mid = (h - 1) / 2;
  for (let y = 0; y < h; y++) {
    const d = Math.abs(y - mid) / mid;       // 0 at centre -> 1 at edge
    const a = Math.max(0, 1 - d * d);        // smooth falloff
    g.fillStyle(0xffffff, a);
    g.fillRect(0, y, w, 1);
  }
  g.generateTexture(key, w, h);
  g.destroy();
}

// A tiny soft spark for particle bursts.
function makeSparkTexture(scene, key) {
  const r = 6;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0xffffff, 1);
  g.fillCircle(r, r, r);
  g.generateTexture(key, r * 2, r * 2);
  g.destroy();
}

// The base / core the player defends.
function makeBaseTexture(scene, key) {
  const w = 90;
  const h = 110;
  const cx = w / 2;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(cx, h - 6, w * 0.8, 16);

  // Pylon body.
  g.fillStyle(0x3a3560, 1);
  g.fillRoundedRect(cx - 26, h * 0.35, 52, h * 0.55, 8);
  g.lineStyle(3, 0x161620, 1);
  g.strokeRoundedRect(cx - 26, h * 0.35, 52, h * 0.55, 8);

  // Glowing core orb.
  g.fillStyle(0x8be9ff, 0.4);
  g.fillCircle(cx, h * 0.32, 26);
  g.fillStyle(0x8be9ff, 1);
  g.fillCircle(cx, h * 0.32, 16);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(cx - 3, h * 0.32 - 3, 6);

  g.generateTexture(key, w, h);
  g.destroy();
}

// Public entry: generate every placeholder texture. Called once from BootScene.
export function generatePlaceholderTextures(scene) {
  makeTileTexture(scene, 'tile-ground', PALETTE.tileGround, PALETTE.tileGroundEdge);
  makeTileTexture(scene, 'tile-path', PALETTE.tilePath, PALETTE.tilePathEdge);

  // Only generate a placeholder when a real asset hasn't already been loaded
  // under that key (see BootScene.preload). This is the art seam in action.
  for (const t of TOWER_LIST) {
    if (!scene.textures.exists(t.textureKey)) {
      makeBotTexture(scene, t.textureKey, { color: t.color, accent: t.accent, w: 64, h: 92 });
    }
    if (!scene.textures.exists(t.projectileKey)) {
      makeBoltTexture(scene, t.projectileKey, t.color);
    }
  }
  for (const e of ENEMY_LIST) {
    if (!scene.textures.exists(e.textureKey)) {
      makeBotTexture(scene, e.textureKey, { color: e.color, accent: e.accent, w: 52, h: 64 });
    }
  }

  makeSparkTexture(scene, 'spark');
  makeBeamTexture(scene, 'laser-beam');
  makeBaseTexture(scene, 'base-core');
}
