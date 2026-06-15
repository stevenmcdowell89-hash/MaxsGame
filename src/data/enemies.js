// ---------------------------------------------------------------------------
// Enemy definitions. Add a new enemy by adding an entry here.
//
// Field reference:
//   id          unique key
//   name        display name
//   textureKey  placeholder/real texture key (see towers.js note)
//   maxHp       hit points
//   speed       movement speed, in TILES per second (base / fallback)
//   speedRange  [min, max] tiles/sec — each enemy wanders its speed within this
//   speedVaryMs [min, max] ms between random speed re-rolls (per enemy)
//   reward      gold granted on kill
//   damage      lives lost if it reaches the base
//   color       base colour for the generated placeholder art
//   accent      secondary colour (eye glow)
// ---------------------------------------------------------------------------

export const ENEMIES = {
  scrapling: {
    id: 'scrapling',
    name: 'Scrapling',
    textureKey: 'enemy-scrapling',
    maxHp: 60,
    speed: 3.0, // tuned up for the larger 22x18 board's longer path
    speedRange: [2.8, 3.2],   // each one drifts its speed in this band
    speedVaryMs: [2000, 3500], // re-rolling every couple of seconds
    reward: 6,
    damage: 1,
    color: 0xff8a6b,
    accent: 0xffe27a,
  },
};

export const ENEMY_LIST = Object.values(ENEMIES);
