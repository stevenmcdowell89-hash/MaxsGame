// ---------------------------------------------------------------------------
// HUDScene: all UI, rendered as a separate scene that runs in parallel on top
// of the GameScene. It never touches game state directly — it reflects state
// from EventBus events and sends player intent back over EventBus.
//
// Touch-first: large tap targets, clear labels, immediate visual feedback.
// ---------------------------------------------------------------------------

import { GAME, PALETTE } from '../data/game.js';
import { EventBus, EVENTS } from '../core/EventBus.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export class HUDScene extends Phaser.Scene {
  constructor() {
    super('hud');
  }

  create() {
    this.buildActive = false;
    this.waveReady = false;
    this.tower = null;

    this.buildTopBar();
    this.buildBottomBar();
    this.buildOverlay();

    this.bindEvents();

    // Tell the GameScene we're subscribed so it (re)publishes the initial state.
    // Covers the first-load race where the HUD boots after the GameScene.
    EventBus.emit(EVENTS.HUD_READY);
  }

  // ------------------------------------------------------------- top bar ----

  buildTopBar() {
    const w = GAME.width;
    this.add.rectangle(0, 0, w, 56, PALETTE.hudPanel, 0.85).setOrigin(0, 0);

    const style = { fontFamily: FONT, fontSize: '26px', color: PALETTE.hudText, fontStyle: 'bold' };
    this.livesText = this.add.text(24, 14, '', { ...style, color: PALETTE.lives });
    this.goldText = this.add.text(260, 14, '', { ...style, color: PALETTE.gold });
    this.waveText = this.add.text(0, 14, '', style).setOrigin(0.5, 0);
    this.waveText.x = w / 2 + 120;
    this.bestText = this.add.text(w - 24, 16, '', { ...style, fontSize: '20px', color: PALETTE.hudAccent }).setOrigin(1, 0);
  }

  // ---------------------------------------------------------- bottom bar ----

  buildBottomBar() {
    const w = GAME.width;
    const h = GAME.height;
    this.add.rectangle(0, h - 96, w, 96, PALETTE.hudPanel, 0.85).setOrigin(0, 0);

    // Build button (left).
    this.buildBtn = this.makeButton(150, h - 48, 240, 68, 'BUILD', () => {
      EventBus.emit(EVENTS.REQUEST_BUILD_MODE, {
        active: !this.buildActive,
        towerId: this.tower ? this.tower.id : undefined,
      });
    });

    // Start Wave button (right-centre).
    this.startBtn = this.makeButton(w / 2 + 120, h - 48, 280, 68, 'START WAVE', () => {
      EventBus.emit(EVENTS.REQUEST_START_WAVE);
    });

    // Mute button (far right).
    this.muteBtn = this.makeButton(w - 90, h - 48, 150, 68, 'SOUND', () => {
      EventBus.emit(EVENTS.REQUEST_TOGGLE_MUTE);
    });
  }

  // A reusable touch button. Returns an object with helpers to update it.
  makeButton(cx, cy, w, h, label, onTap) {
    const container = this.add.container(cx, cy);
    const bg = this.add.rectangle(0, 0, w, h, 0x2b2748, 1).setStrokeStyle(2, 0x4a4470);
    const txt = this.add.text(0, 0, label, {
      fontFamily: FONT, fontSize: '24px', color: PALETTE.hudText, fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add([bg, txt]);

    // The BACKGROUND rectangle is the interactive target — a concrete shaped
    // object whose hit area Phaser computes from its full size. The label sits
    // on top and is never interactive, so it can't create a "dead" centre that
    // only responds at the edges (the symptom seen on the tablet). This nested
    // interactive-child-of-container pattern hit-tests reliably on touch.
    bg.setInteractive({ useHandCursor: true });

    const api = {
      container, bg, txt,
      enabled: true,
      active: false,
      setLabel: (s) => txt.setText(s),
      setActive: (on) => {
        api.active = on;
        bg.fillColor = on ? 0x49d49a : 0x2b2748;
        txt.setColor(on ? '#0c1410' : PALETTE.hudText);
      },
      setEnabled: (on) => {
        api.enabled = on;
        container.alpha = on ? 1 : 0.4;
        if (on) bg.setInteractive({ useHandCursor: true });
        else bg.disableInteractive();
      },
    };

    bg.on('pointerover', () => { if (api.enabled) bg.setStrokeStyle(2, 0x8be9ff); });
    bg.on('pointerout', () => bg.setStrokeStyle(2, 0x4a4470));
    bg.on('pointerdown', () => {
      if (!api.enabled) return;
      this.tweens.add({ targets: container, scaleX: 0.95, scaleY: 0.95, duration: 60, yoyo: true });
    });
    bg.on('pointerup', () => { if (api.enabled) onTap(); });

    return api;
  }

  // --------------------------------------------------------- end overlay ----

  buildOverlay() {
    this.overlay = this.add.container(0, 0).setVisible(false).setDepth(10);
    const dim = this.add.rectangle(0, 0, GAME.width, GAME.height, 0x000000, 0.6).setOrigin(0, 0);
    this.overlayTitle = this.add.text(GAME.width / 2, GAME.height / 2 - 80, '', {
      fontFamily: FONT, fontSize: '64px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.overlaySub = this.add.text(GAME.width / 2, GAME.height / 2, '', {
      fontFamily: FONT, fontSize: '28px', color: PALETTE.hudAccent,
    }).setOrigin(0.5);
    const restart = this.makeButton(GAME.width / 2, GAME.height / 2 + 90, 260, 72, 'PLAY AGAIN', () => {
      // Guard against stray taps while the overlay is hidden.
      if (this.overlay.visible) EventBus.emit(EVENTS.REQUEST_RESTART);
    });
    this.overlay.add([dim, this.overlayTitle, this.overlaySub, restart.container]);
  }

  // ------------------------------------------------------------- wiring ----

  bindEvents() {
    const on = (evt, fn) => {
      EventBus.on(evt, fn);
      this.events.once('shutdown', () => EventBus.off(evt, fn));
    };

    on(EVENTS.STATE_INIT, (s) => {
      this.tower = s.tower;
      this.setLives(s.lives);
      this.setGold(s.gold);
      this.setWave(s.wave, s.totalWaves);
      this.bestText.setText(`BEST: WAVE ${s.best}`);
      this.setMuted(s.muted);
      this.overlay.setVisible(false);
      this.buildActive = false;
      this.buildBtn.setActive(false);
      this.refreshBuildLabel();
    });

    on(EVENTS.GOLD_CHANGED, (g) => { this.setGold(g); this.refreshBuildLabel(); });
    on(EVENTS.LIVES_CHANGED, (l) => this.setLives(l));
    on(EVENTS.WAVE_CHANGED, ({ wave, totalWaves }) => this.setWave(wave, totalWaves));
    on(EVENTS.WAVE_READY, (ready) => {
      this.waveReady = ready;
      this.startBtn.setEnabled(ready);
      this.startBtn.setLabel(ready ? 'START WAVE' : 'IN PROGRESS…');
    });
    on(EVENTS.BUILD_MODE_CHANGED, (active) => {
      this.buildActive = active;
      this.buildBtn.setActive(active);
    });
    on(EVENTS.MUTE_CHANGED, (muted) => this.setMuted(muted));
    on(EVENTS.GAME_OVER, ({ win, wave, best }) => this.showOverlay(win, wave, best));
  }

  setLives(v) { this.livesText.setText(`LIVES ${v}`); }
  setGold(v) { this.goldText.setText(`GOLD ${v}`); this._gold = v; }
  setWave(w, total) { this.waveText.setText(`WAVE ${w} / ${total}`); }
  setMuted(m) { this.muteBtn.setActive(false); this.muteBtn.setLabel(m ? 'MUTED' : 'SOUND'); }

  refreshBuildLabel() {
    if (!this.tower) return;
    const affordable = (this._gold ?? 0) >= this.tower.cost;
    this.buildBtn.setLabel(`BUILD  (${this.tower.cost})`);
    this.buildBtn.setEnabled(affordable || this.buildActive);
  }

  showOverlay(win, wave, best) {
    this.overlayTitle.setText(win ? 'VICTORY!' : 'DEFEATED');
    this.overlayTitle.setColor(win ? '#9bf6c0' : '#ff8a7a');
    this.overlaySub.setText(win
      ? `All waves cleared!   Best: wave ${best}`
      : `You cleared ${wave} wave${wave === 1 ? '' : 's'}.   Best: wave ${best}`);
    this.overlay.setVisible(true);
  }
}
