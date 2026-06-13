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
// ---------------------------------------------------------------------------

export const TOWERS = {
  blaster: {
    id: 'blaster',
    name: 'Blaster Bot',
    textureKey: 'tower-blaster',
    cost: 50,
    range: 2.7,
    fireRate: 620,
    damage: 18,
    projectileSpeed: 540,
    projectileKey: 'proj-bolt',
    color: 0x7fc7ff,
    accent: 0xfff27a,
  },
};

// The tower the build bar offers first. (List order is preserved for future
// multi-tower bars.)
export const DEFAULT_TOWER_ID = 'blaster';

export const TOWER_LIST = Object.values(TOWERS);
