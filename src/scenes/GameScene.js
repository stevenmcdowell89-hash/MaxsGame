// ---------------------------------------------------------------------------
// GameScene: the gameplay world. It is the single owner of all entities
// (towers, enemies, projectiles) and of the run state (lives, gold, waves).
// Systems (grid, placement, waves, targeting) and entities are composed here;
// the HUD is a separate scene that talks to this one only through EventBus.
// ---------------------------------------------------------------------------

import { GAME, ISO, PALETTE, DEPTH } from '../data/game.js';
import { LEVELS, DEFAULT_LEVEL_ID } from '../data/levels.js';
import { WAVES } from '../data/waves.js';
import { ENEMIES } from '../data/enemies.js';
import { TOWERS, DEFAULT_TOWER_ID } from '../data/towers.js';

import { EventBus, EVENTS } from '../core/EventBus.js';
import { SaveManager } from '../core/SaveManager.js';
import { AudioManager } from '../audio/AudioManager.js';

import { IsoGrid } from '../systems/IsoGrid.js';
import { PlacementManager } from '../systems/PlacementManager.js';
import { WaveManager } from '../systems/WaveManager.js';
import { CameraController } from '../systems/CameraController.js';

import { Enemy } from '../entities/Enemy.js';
import { Tower } from '../entities/Tower.js';
import { Projectile } from '../entities/Projectile.js';

const TILE_THICKNESS = 10; // must match textures.js makeTileTexture

export class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  create() {
    this.level = LEVELS[DEFAULT_LEVEL_ID];

    // ---- Run state ----
    this.lives = GAME.startingLives;
    this.gold = GAME.startingGold;
    this.clearedWaves = 0;
    this.waveActive = false;
    this.gameOver = false;

    // ---- Entity lists (scene is the sole owner) ----
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];

    // Currently inspected tower (tap a built tower to see its range + sell it).
    this.selectedTower = null;

    // ---- Audio (persist one AudioManager across scene restarts) ----
    this.audio = this.registry.get('audio');
    if (!this.audio) {
      this.audio = new AudioManager(SaveManager.isMuted());
      this.registry.set('audio', this.audio);
    }

    // ---- Build the board ----
    const playArea = { x: 0, y: 64, width: GAME.width, height: GAME.height - 64 - 110 };
    this.grid = new IsoGrid(this.level, playArea);
    this.drawBoard();

    // Range ring shown when a built tower is selected (below entities).
    this.rangeRing = this.add.graphics();
    this.rangeRing.setDepth(DEPTH.entityBase - 1);
    this.rangeRing.setVisible(false);

    // ---- Systems ----
    this.placement = new PlacementManager(this, this.grid);
    this.waves = new WaveManager(WAVES[this.level.id], (typeId) => this.spawnEnemy(typeId));

    // ---- Camera (pan + zoom across the larger board) ----
    this.setupCamera();

    // ---- Input ----
    this.setupInput();

    // ---- Cross-scene wiring ----
    this.bindEvents();

    // Tell the HUD the starting state.
    this.publishInit();
  }

  // ---------------------------------------------------------------- board ----

  drawBoard() {
    const originYFrac = (ISO.tileHeight / 2) / (ISO.tileHeight + TILE_THICKNESS);
    for (let r = 0; r < this.level.rows; r++) {
      for (let c = 0; c < this.level.cols; c++) {
        const pos = this.grid.toScreen(c, r);
        const key = this.grid.isPath(c, r) ? 'tile-path' : 'tile-ground';
        const tile = this.add.sprite(pos.x, pos.y, key);
        tile.setOrigin(0.5, originYFrac);
        tile.setDepth(DEPTH.tiles + (c + r));
      }
    }

    // Spawn marker (subtle pulsing ring).
    const sp = this.grid.spawnPoint;
    const portal = this.add.ellipse(sp.x, sp.y, ISO.tileWidth * 0.5, ISO.tileHeight * 0.5, 0xff7a6c, 0.25);
    portal.setDepth(DEPTH.tiles + 50);
    this.tweens.add({ targets: portal, scale: 1.3, alpha: 0.1, duration: 900, yoyo: true, repeat: -1 });

    // Base / core to defend.
    const bp = this.grid.basePoint;
    this.base = this.add.sprite(bp.x, bp.y, 'base-core');
    this.base.setOrigin(0.5, 0.86);
    this.base.setDepth(DEPTH.entityBase + bp.y);
    this.tweens.add({ targets: this.base, y: bp.y - 4, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // --------------------------------------------------------------- camera ----

  setupCamera() {
    const cam = this.cameras.main;
    const bounds = this.grid.getBounds(48);
    cam.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);

    // Zoom at which the whole board fits the viewport — the most zoomed-out we
    // allow (and the starting view, so the big map reads at a glance).
    const fitZoom = Math.min(GAME.width / bounds.width, GAME.height / bounds.height);
    const minZoom = Math.min(fitZoom, 1);

    this.camCtl = new CameraController(this, { minZoom, maxZoom: 1.5 });
    cam.setZoom(Phaser.Math.Clamp(fitZoom, minZoom, 1.5));
    cam.centerOn(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  }

  // Convert a pointer (screen space) to world space via the main camera, so
  // building/selection stay correct at any pan/zoom.
  worldPoint(pointer) {
    return this.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }

  // The world camera now fills the whole viewport (it can pan/zoom under the
  // translucent HUD bars), so a tap on a HUD button would otherwise also hit a
  // board cell behind it. Treat only gestures that START outside the HUD bands
  // as "world" gestures; taps on the bars belong to the HUD alone.
  isOverHud(pointer) {
    return pointer.y < 56 || pointer.y > GAME.height - 96;
  }

  // ---------------------------------------------------------------- input ----

  setupInput() {
    // Unlock Web Audio on the first interaction (autoplay policy).
    this.input.once('pointerdown', () => this.audio.unlock());

    this.input.on('pointerdown', (pointer) => {
      // A gesture that starts on the HUD bars is the HUD's, not the world's.
      this._worldGesture = !this.isOverHud(pointer);
      if (this._worldGesture) this.camCtl.onPointerDown(pointer);
    });

    this.input.on('pointermove', (pointer) => {
      // Desktop hover affordance: track the build highlight even with no button
      // held, as long as the pointer is over the board (not the HUD bars).
      if (this.placement.active && !pointer.isDown) {
        if (!this.isOverHud(pointer)) {
          const wp = this.worldPoint(pointer);
          this.placement.onPointerMove(wp.x, wp.y);
        }
        return;
      }
      if (!this._worldGesture) return;
      const gesture = this.camCtl.onPointerMove(pointer);
      // Only update the build highlight when the camera isn't being panned.
      if (!gesture && this.placement.active) {
        const wp = this.worldPoint(pointer);
        this.placement.onPointerMove(wp.x, wp.y);
      }
    });

    this.input.on('pointerup', (pointer) => {
      if (!this._worldGesture) return;
      // A pan/pinch release isn't a tap — don't build or select on it.
      if (this.camCtl.onPointerUp(pointer)) return;
      const wp = this.worldPoint(pointer);
      // In build mode the placement manager consumes the tap. Otherwise, treat
      // it as a tower inspect/deselect tap.
      const consumed = this.placement.onPointerUp(wp.x, wp.y);
      if (!consumed) this.handleSelectTap(wp.x, wp.y);
    });

    this.input.on('wheel', (pointer, _objs, _dx, dy) => this.camCtl.onWheel(dy, pointer));
  }

  bindEvents() {
    // Bound handlers so we can detach them on shutdown (avoids dupes on restart).
    this._onBuildMode = ({ active, towerId }) => {
      const def = TOWERS[towerId || DEFAULT_TOWER_ID];
      // Inspecting and building are mutually exclusive interactions.
      if (active) this.deselectTower();
      this.placement.setMode(active, def);
      // In build mode a one-finger drag aims the highlight, so disable one-finger
      // panning (two-finger pinch/pan still works); restore it otherwise.
      this.camCtl.setSingleDragPan(!active);
      EventBus.emit(EVENTS.BUILD_MODE_CHANGED, active);
    };
    // HUD boots after this scene on first load, so it can miss the STATE_INIT
    // we emit in create(). When the HUD signals it's ready, (re)publish state.
    this._onHudReady = () => this.publishInit();
    this._onStartWave = () => this.startWave();
    this._onSellTower = () => this.sellSelectedTower();
    this._onZoom = (dir) => this.camCtl.zoomStep(dir);
    this._onRestart = () => this.scene.restart();
    this._onToggleMute = () => {
      const muted = this.audio.setMuted(!this.audio.muted);
      SaveManager.setMuted(muted);
      EventBus.emit(EVENTS.MUTE_CHANGED, muted);
    };

    EventBus.on(EVENTS.HUD_READY, this._onHudReady);
    EventBus.on(EVENTS.REQUEST_BUILD_MODE, this._onBuildMode);
    EventBus.on(EVENTS.REQUEST_START_WAVE, this._onStartWave);
    EventBus.on(EVENTS.REQUEST_SELL_TOWER, this._onSellTower);
    EventBus.on(EVENTS.REQUEST_ZOOM, this._onZoom);
    EventBus.on(EVENTS.REQUEST_RESTART, this._onRestart);
    EventBus.on(EVENTS.REQUEST_TOGGLE_MUTE, this._onToggleMute);

    this.events.once('shutdown', () => {
      EventBus.off(EVENTS.HUD_READY, this._onHudReady);
      EventBus.off(EVENTS.REQUEST_BUILD_MODE, this._onBuildMode);
      EventBus.off(EVENTS.REQUEST_START_WAVE, this._onStartWave);
      EventBus.off(EVENTS.REQUEST_SELL_TOWER, this._onSellTower);
      EventBus.off(EVENTS.REQUEST_ZOOM, this._onZoom);
      EventBus.off(EVENTS.REQUEST_RESTART, this._onRestart);
      EventBus.off(EVENTS.REQUEST_TOGGLE_MUTE, this._onToggleMute);
    });
  }

  publishInit() {
    EventBus.emit(EVENTS.STATE_INIT, {
      lives: this.lives,
      gold: this.gold,
      wave: 0,
      totalWaves: this.waves.totalWaves,
      best: SaveManager.getBestWave(),
      muted: this.audio.muted,
      tower: TOWERS[DEFAULT_TOWER_ID],
    });
    EventBus.emit(EVENTS.WAVE_READY, true);
  }

  // ------------------------------------------------------------- economy ----

  canAfford(cost) {
    return this.gold >= cost;
  }

  addGold(amount) {
    this.gold += amount;
    EventBus.emit(EVENTS.GOLD_CHANGED, this.gold);
  }

  spendGold(amount) {
    this.gold -= amount;
    EventBus.emit(EVENTS.GOLD_CHANGED, this.gold);
  }

  loseLife(amount) {
    this.lives = Math.max(0, this.lives - amount);
    EventBus.emit(EVENTS.LIVES_CHANGED, this.lives);
    this.audio.baseHit();
    this.cameras.main.shake(150, 0.006);
    if (this.lives <= 0) this.endGame(false);
  }

  rangePxFor(def) {
    return this.grid.tilesToPixels(def.range);
  }

  // -------------------------------------------------------------- towers ----

  tryBuildTower(cell, def) {
    if (!this.grid.isBuildable(cell.c, cell.r)) {
      this.audio.deny();
      return;
    }
    if (!this.canAfford(def.cost)) {
      this.audio.deny();
      return;
    }
    this.spendGold(def.cost);
    this.grid.occupy(cell.c, cell.r);
    const pos = this.grid.toScreen(cell.c, cell.r);
    const tower = new Tower(this, def, cell, pos, this.rangePxFor(def));
    this.towers.push(tower);
    this.audio.place();
    this.spawnPlaceDust(pos);
  }

  spawnPlaceDust(pos) {
    const dust = this.add.particles(pos.x, pos.y, 'spark', {
      speed: { min: 40, max: 110 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.7, end: 0 },
      lifespan: 300,
      quantity: 10,
      tint: 0xffffff,
      blendMode: 'ADD',
      emitting: false,
    });
    dust.setDepth(DEPTH.entityBase + pos.y + DEPTH.effectBias);
    dust.explode();
    this.time.delayedCall(340, () => dust.destroy());
  }

  // ----------------------------------------------------- tower inspect ----

  // A tap that wasn't consumed by build mode: select a built tower (showing its
  // range + a sell option) or deselect when tapping elsewhere on the board.
  handleSelectTap(worldX, worldY) {
    if (this.gameOver) return;
    const cell = this.grid.cellAt(worldX, worldY);
    // Off-board taps (e.g. on the HUD bars) shouldn't change the selection.
    if (!cell) return;
    const tower = this.towerAt(cell);
    if (tower) {
      if (this.selectedTower === tower) this.deselectTower();
      else this.selectTower(tower);
    } else {
      this.deselectTower();
    }
  }

  towerAt(cell) {
    return this.towers.find((t) => t.cell.c === cell.c && t.cell.r === cell.r) || null;
  }

  selectTower(tower) {
    this.selectedTower = tower;
    this.drawRangeRing(tower);
    this.audio.select();
    EventBus.emit(EVENTS.TOWER_SELECTED, { refund: this.refundFor(tower) });
  }

  deselectTower() {
    if (!this.selectedTower) return;
    this.selectedTower = null;
    this.rangeRing.clear();
    this.rangeRing.setVisible(false);
    EventBus.emit(EVENTS.TOWER_DESELECTED);
  }

  drawRangeRing(tower) {
    const color = PALETTE.tileBuildOk;
    this.rangeRing.clear();
    this.rangeRing.lineStyle(2, color, 0.6);
    this.rangeRing.fillStyle(color, 0.08);
    this.rangeRing.fillCircle(tower.x, tower.y, tower.rangePx);
    this.rangeRing.strokeCircle(tower.x, tower.y, tower.rangePx);
    this.rangeRing.setVisible(true);
  }

  refundFor(tower) {
    return Math.floor(tower.def.cost * GAME.sellRefund);
  }

  sellSelectedTower() {
    const tower = this.selectedTower;
    if (!tower || this.gameOver) return;
    const refund = this.refundFor(tower);
    this.grid.release(tower.cell.c, tower.cell.r);
    const idx = this.towers.indexOf(tower);
    if (idx >= 0) this.towers.splice(idx, 1);
    this.deselectTower();
    this.spawnPlaceDust({ x: tower.x, y: tower.y });
    tower.destroy();
    this.addGold(refund);
    this.audio.sell();
  }

  // ------------------------------------------------------------- enemies ----

  spawnEnemy(typeId) {
    const def = ENEMIES[typeId];
    const enemy = new Enemy(this, def, this.grid.pathPoints, this.grid.iso.tileStep);
    this.enemies.push(enemy);
  }

  // ------------------------------------------------------------- weapons ----

  // Route a tower's shot to the right weapon (the tower is weapon-agnostic).
  fireWeapon(def, x, y, target) {
    if (def.weapon === 'laser') this.fireLaser(def, x, y, target);
    else this.fireProjectile(def, x, y, target);
  }

  fireProjectile(def, x, y, target) {
    const proj = new Projectile(this, x, y, def, target, this.audio);
    this.projectiles.push(proj);
  }

  // Hitscan laser: damage is applied immediately and a beam is drawn from the
  // muzzle to the target, then fades.
  fireLaser(def, x, y, target) {
    if (!target || !target.alive) return;
    const tx = target.x;
    const ty = target.y - (target.body ? target.body.displayHeight * 0.45 : 20);
    this.drawLaserBeam(x, y, tx, ty, def);
    target.takeDamage(def.damage, this.audio);
    this.audio.laser();
  }

  drawLaserBeam(x1, y1, x2, y2, def) {
    const color = def.laserColor ?? def.accent ?? 0xffffff;
    const depth = DEPTH.entityBase + Math.max(y1, y2) + DEPTH.effectBias;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const angle = Math.atan2(y2 - y1, x2 - x1);

    // Stretched additive sprites: a coloured glow + a white-hot core.
    const glow = this.add.image(mx, my, 'laser-beam')
      .setRotation(angle).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
    glow.setDisplaySize(dist, 22);
    const core = this.add.image(mx, my, 'laser-beam')
      .setRotation(angle).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 1);
    core.setDisplaySize(dist, 6);
    this.tweens.add({
      targets: [glow, core], alpha: 0, duration: 190, ease: 'Quad.easeOut',
      onComplete: () => { glow.destroy(); core.destroy(); },
    });

    const hit = this.add.particles(x2, y2, 'spark', {
      speed: { min: 50, max: 160 }, angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 }, lifespan: 240, quantity: 8,
      tint: [color, 0xffffff], blendMode: 'ADD', emitting: false,
    });
    hit.setDepth(depth + 2);
    hit.explode();
    this.time.delayedCall(280, () => hit.destroy());
  }

  // ---------------------------------------------------------------- waves ----

  startWave() {
    if (this.gameOver || this.waveActive || !this.waves.hasMoreWaves) return;
    const wave = this.waves.startNextWave();
    if (!wave) return;
    this.waveActive = true;
    this.audio.waveStart();
    EventBus.emit(EVENTS.WAVE_CHANGED, { wave: this.waves.waveNumber, totalWaves: this.waves.totalWaves });
    EventBus.emit(EVENTS.WAVE_READY, false);
  }

  onWaveCleared() {
    this.waveActive = false;
    this.clearedWaves = this.waves.waveNumber;
    this.addGold(this.waves.currentWaveReward());

    if (this.waves.isLastWave) {
      this.endGame(true);
    } else {
      EventBus.emit(EVENTS.WAVE_READY, true);
    }
  }

  endGame(win) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.waveActive = false;
    this.placement.setMode(false);
    this.deselectTower();

    SaveManager.recordResult({ win, wavesCleared: this.clearedWaves });
    if (win) this.audio.win(); else this.audio.lose();

    EventBus.emit(EVENTS.GAME_OVER, {
      win,
      wave: this.clearedWaves,
      best: SaveManager.getBestWave(),
    });
  }

  // ----------------------------------------------------------------- loop ----

  update(time, delta) {
    if (this.gameOver) return;

    // Spawning.
    this.waves.update(delta);

    // Enemies.
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.active) { this.enemies.splice(i, 1); continue; }
      const status = e.update(delta);
      if (status === 'reachedBase') {
        const dmg = e.damage;
        // Mark dead BEFORE destroying so any in-flight projectile still homing
        // on this enemy stops touching it (it keeps `alive` true otherwise, and
        // poking a destroyed object's scene would throw and freeze the game).
        e.alive = false;
        e.destroy();
        this.enemies.splice(i, 1);
        this.flashBase();
        this.loseLife(dmg);
      } else if (status === 'dead') {
        // Death tween in progress; reward already? handle reward on kill below.
      }
    }
    if (this.gameOver) return;

    // Award gold for enemies that died this frame (alive flipped false but not
    // yet spliced). We detect kills by checking alive===false and a reward flag.
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive && !e._rewarded) {
        e._rewarded = true;
        this.addGold(e.reward);
      }
      if (!e.active) this.enemies.splice(i, 1);
    }

    // Towers.
    for (const t of this.towers) {
      t.update(delta, this.enemies, (def, x, y, target) => this.fireWeapon(def, x, y, target), this.audio);
    }

    // Projectiles.
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.active) { this.projectiles.splice(i, 1); continue; }
      const status = p.update(delta);
      if (status === 'done') this.projectiles.splice(i, 1);
    }

    // Win check: wave finished spawning and the board is clear.
    if (this.waveActive && !this.waves.spawning && this.enemies.length === 0) {
      this.onWaveCleared();
    }
  }

  flashBase() {
    if (!this.base) return;
    this.base.setTintFill(0xff7a6c);
    this.time.delayedCall(90, () => this.base && this.base.clearTint());
  }
}
