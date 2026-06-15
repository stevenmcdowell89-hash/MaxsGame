// ---------------------------------------------------------------------------
// Wave definitions, keyed by level id. Each level maps to an ordered array of
// waves; clearing the last wave wins the level.
//
// A wave is:
//   reward  bonus gold when the wave is fully cleared
//   groups  array of spawn groups that run in sequence within the wave:
//     type      enemy id (see data/enemies.js)
//     count     how many to spawn
//     interval  ms between spawns within the group
//     delay     ms to wait before this group starts (optional, default 0)
//
// Add waves / mix enemy types entirely from here.
// ---------------------------------------------------------------------------

export const WAVES = {
  sectorOne: [
    { reward: 25, groups: [{ type: 'scrapling', count: 5, interval: 1000 }] },
    { reward: 30, groups: [{ type: 'scrapling', count: 8, interval: 850 }] },
    { reward: 35, groups: [{ type: 'scrapling', count: 11, interval: 750 }] },
    { reward: 45, groups: [{ type: 'scrapling', count: 14, interval: 650 }] },
    { reward: 60, groups: [{ type: 'scrapling', count: 18, interval: 520 }] },
    { reward: 70, groups: [{ type: 'scrapling', count: 22, interval: 480 }] },
    { reward: 85, groups: [{ type: 'scrapling', count: 26, interval: 440 }] },
    { reward: 100, groups: [{ type: 'scrapling', count: 30, interval: 400 }] },
    { reward: 120, groups: [{ type: 'scrapling', count: 36, interval: 360 }] },
    { reward: 175, groups: [{ type: 'scrapling', count: 44, interval: 320 }] },
  ],
};
