// ---------------------------------------------------------------------------
// Tower definitions. Add a new tower by adding an entry here — no code changes.
//
// Field reference:
//   id              unique key (also the map key)
//   name            display name (UI)
//   textureKey      texture used by the renderer. A generated placeholder is
//                   created under this key at boot; drop a real PNG with the
//                   same key later and nothing else changes.
//   cost            gold to build
//   range           targeting range, in TILES (converted to pixels by the grid)
//   fireRate        ms between shots
//   damage          damage per projectile
//   projectileSpeed projectile travel speed, pixels/second
//   projectileKey   texture key for the projectile placeholder
//   color           base colour for the generated placeholder art
//   accent          secondary colour (eye / muzzle glow)
//
// Optional REAL-ART fields (when a hand-drawn PNG replaces the placeholder):
//   asset           path to a transparent PNG, loaded under `textureKey`
//   artHeight       on-screen height in px (sprite scaled to this, aspect kept)
//   originX/originY  anchor as 0..1 of the texture; put this over the tile centre
//                    (originX = base centre, originY ≈ bottom of the base)
//   facing          direction the art's barrel points by default ('left'|'right')
//   muzzle          { x, y } px offset from the origin to the barrel tip, where
//                    bolts/flashes spawn (x is mirrored when the tower flips)
// ---------------------------------------------------------------------------

export const TOWERS = {
  blaster: {
    id: 'blaster',
    name: 'Laser Turret',
    textureKey: 'tower-blaster',
    cost: 50,
    range: 2.7,

    // Laser weapon: charges up, then fires an instant beam. Stronger per hit
    // to justify the slower cadence.
    weapon: 'laser',
    chargeTime: 1500,   // ms of charge (with a growing muzzle glow) before firing
    damage: 50,
    laserColor: 0xff7a2a,

    // Projectile fields are unused by the laser but kept so the placeholder
    // bolt texture still generates cleanly for any future projectile tower.
    fireRate: 620,
    projectileSpeed: 540,
    projectileKey: 'proj-bolt',
    color: 0x7fc7ff,
    accent: 0xffb24a,

    // Real art (Max's first tower): a bow-cannon turret with a glowing muzzle.
    asset: 'assets/towers/blaster.png',
    artHeight: 75,      // half the original size
    originX: 0.5,       // base is horizontally centred in the (re-padded) art
    originY: 0.997,     // anchor at the base bottom so it sits on the tile
    facing: 'left',
    muzzle: { xFrac: 0.3645, yFrac: 0.5182 }, // barrel tip, as fractions of size
  },
};

// The tower the build bar offers first. (List order is preserved for future
// multi-tower bars.)
export const DEFAULT_TOWER_ID = 'blaster';

export const TOWER_LIST = Object.values(TOWERS);
