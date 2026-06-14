// ---------------------------------------------------------------------------
// A single shared event emitter used to decouple the game scene from the HUD
// scene (and, later, any other listeners). Scenes import this module and emit /
// subscribe to named events instead of reaching into each other directly.
//
// It's a module singleton: every importer gets the same instance. This keeps a
// clean seam without relying on window globals, so a Vite/TS migration is a
// no-op for this file.
//
// Event names live in EVENTS so they're typo-proof and discoverable.
// ---------------------------------------------------------------------------

export const EventBus = new Phaser.Events.EventEmitter();

export const EVENTS = {
  // GameScene -> HUD (state changed)
  STATE_INIT: 'state:init',     // { lives, gold, wave, totalWaves, best }
  GOLD_CHANGED: 'state:gold',   // gold:number
  LIVES_CHANGED: 'state:lives', // lives:number
  WAVE_CHANGED: 'state:wave',   // { wave, totalWaves }
  WAVE_READY: 'state:waveReady',// canStart:boolean
  GAME_OVER: 'state:gameOver',  // { win:boolean, wave:number, best:number }
  TOWER_SELECTED: 'state:towerSelected',     // { refund:number }
  TOWER_DESELECTED: 'state:towerDeselected',

  // HUD -> GameScene (player intent)
  HUD_READY: 'cmd:hudReady',           // HUD finished setup; ask for initial state
  REQUEST_BUILD_MODE: 'cmd:buildMode', // { active:boolean, towerId }
  REQUEST_START_WAVE: 'cmd:startWave',
  REQUEST_RESTART: 'cmd:restart',
  REQUEST_TOGGLE_MUTE: 'cmd:toggleMute', // -> emits MUTE_CHANGED back
  REQUEST_SELL_TOWER: 'cmd:sellTower',   // sell the currently selected tower
  REQUEST_ZOOM: 'cmd:zoom',              // dir: +1 (in) / -1 (out)

  // GameScene -> HUD (feedback)
  BUILD_MODE_CHANGED: 'fx:buildMode', // active:boolean
  MUTE_CHANGED: 'fx:mute',            // muted:boolean
};
