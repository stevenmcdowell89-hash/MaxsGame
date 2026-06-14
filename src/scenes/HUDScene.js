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
    this.selectedId = null;       // which piece the build bar has selected
    this.pieceButtons = {};       // id -> button api (built on STATE_INIT)
    this._pieces = null;

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

    // The piece palette (left) is built from data on STATE_INIT — see
    // buildPalette(). It replaces the old single BUILD button.

    // Sell button (centre-left): only visible while a built piece is selected.
    this.sellBtn = this.makeButton(545, h - 48, 120, 68, 'SELL', () => {
      EventBus.emit(EVENTS.REQUEST_SELL_TOWER);
    }, { fontSize: '20px' });
    this.sellBtn.container.setVisible(false);

    // Start Wave button (right-centre).
    this.startBtn = this.makeButton(770, h - 48, 250, 68, 'START WAVE', () => {
      EventBus.emit(EVENTS.REQUEST_START_WAVE);
    });

    // Zoom controls (between Start Wave and Sound).
    this.makeButton(958, h - 48, 80, 68, '−', () => {
      EventBus.emit(EVENTS.REQUEST_ZOOM, -1);
    });
    this.makeButton(1048, h - 48, 80, 68, '+', () => {
      EventBus.emit(EVENTS.REQUEST_ZOOM, 1);
    });

    // Mute button (far right).
    this.muteBtn = this.makeButton(w - 90, h - 48, 150, 68, 'SOUND', () => {
      EventBus.emit(EVENTS.REQUEST_TOGGLE_MUTE);
    });
  }

  // A reusable touch button. Returns an object with helpers to update it.
  makeButton(cx, cy, w, h, label, onTap, opts = {}) {
    const container = this.add.container(cx, cy);
    const bg = this.add.rectangle(0, 0, w, h, 0x2b2748, 1).setStrokeStyle(2, 0x4a4470);
    const txt = this.add.text(0, 0, label, {
      fontFamily: FONT, fontSize: opts.fontSize ?? '24px', color: PALETTE.hudText,
      fontStyle: 'bold', align: 'center',
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

  // ----------------------------------------------------- piece palette ----

  // Build the left-hand row of piece buttons from the data the GameScene sends.
  // Built once; STATE_INIT can republish (e.g. on restart) without rebuilding.
  buildPalette(pieces) {
    if (this._paletteBuilt) return;
    this._paletteBuilt = true;
    this._pieces = pieces;

    const h = GAME.height;
    const centers = [64, 182, 300, 418];
    pieces.slice(0, centers.length).forEach((p, i) => {
      const short = p.isSource ? 'CONDUIT' : p.name.split(' ')[0].toUpperCase();
      const sub = p.isSource ? `⚡ ${p.cost}g` : `T${p.tier} · ${p.cost}g`;
      const btn = this.makeButton(centers[i], h - 48, 110, 72, `${short}\n${sub}`, () => {
        // Toggle: tapping the selected piece exits build mode; tapping another
        // switches to it.
        const active = !(this.buildActive && this.selectedId === p.id);
        EventBus.emit(EVENTS.REQUEST_BUILD_MODE, { active, towerId: p.id });
      }, { fontSize: '15px' });
      this.pieceButtons[p.id] = btn;
    });

    this.refreshPalette();
  }

  // Highlight the active piece (others go inactive).
  refreshPaletteActive() {
    for (const id of Object.keys(this.pieceButtons)) {
      this.pieceButtons[id].setActive(this.buildActive && this.selectedId === id);
    }
  }

  // Enable/disable each piece button by affordability (the selected piece stays
  // enabled so it can be toggled back off even when funds dip).
  refreshPalette() {
    if (!this._pieces) return;
    const gold = this._gold ?? 0;
    for (const p of this._pieces) {
      const btn = this.pieceButtons[p.id];
      if (!btn) continue;
      const affordable = gold >= p.cost;
      btn.setEnabled(affordable || (this.buildActive && this.selectedId === p.id));
    }
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
      if (s.pieces) this.buildPalette(s.pieces);
      this.setGold(s.gold);
      this.setLives(s.lives);
      this.setWave(s.wave, s.totalWaves);
      this.bestText.setText(`BEST: WAVE ${s.best}`);
      this.setMuted(s.muted);
      this.overlay.setVisible(false);
      this.buildActive = false;
      this.selectedId = null;
      this.refreshPaletteActive();
      this.refreshPalette();
      this.hideSell();
    });

    on(EVENTS.GOLD_CHANGED, (g) => { this.setGold(g); this.refreshPalette(); });
    on(EVENTS.LIVES_CHANGED, (l) => this.setLives(l));
    on(EVENTS.WAVE_CHANGED, ({ wave, totalWaves }) => this.setWave(wave, totalWaves));
    on(EVENTS.WAVE_READY, (ready) => {
      this.waveReady = ready;
      this.startBtn.setEnabled(ready);
      this.startBtn.setLabel(ready ? 'START WAVE' : 'IN PROGRESS…');
    });
    on(EVENTS.BUILD_MODE_CHANGED, ({ active, pieceId }) => {
      this.buildActive = active;
      this.selectedId = active ? pieceId : null;
      this.refreshPaletteActive();
      this.refreshPalette();
      if (active) this.hideSell();
    });
    on(EVENTS.TOWER_SELECTED, ({ refund }) => this.showSell(refund));
    on(EVENTS.TOWER_DESELECTED, () => this.hideSell());
    on(EVENTS.MUTE_CHANGED, (muted) => this.setMuted(muted));
    on(EVENTS.GAME_OVER, ({ win, wave, best }) => { this.hideSell(); this.showOverlay(win, wave, best); });
  }

  showSell(refund) {
    this.sellBtn.setLabel(`SELL  (+${refund})`);
    this.sellBtn.container.setVisible(true);
  }

  hideSell() {
    this.sellBtn.container.setVisible(false);
  }

  setLives(v) { this.livesText.setText(`LIVES ${v}`); }
  setGold(v) { this.goldText.setText(`GOLD ${v}`); this._gold = v; }
  setWave(w, total) { this.waveText.setText(`WAVE ${w} / ${total}`); }
  setMuted(m) { this.muteBtn.setActive(false); this.muteBtn.setLabel(m ? 'MUTED' : 'SOUND'); }

  showOverlay(win, wave, best) {
    this.overlayTitle.setText(win ? 'VICTORY!' : 'DEFEATED');
    this.overlayTitle.setColor(win ? '#9bf6c0' : '#ff8a7a');
    this.overlaySub.setText(win
      ? `All waves cleared!   Best: wave ${best}`
      : `You cleared ${wave} wave${wave === 1 ? '' : 's'}.   Best: wave ${best}`);
    this.overlay.setVisible(true);
  }
}
