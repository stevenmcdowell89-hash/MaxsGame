// ---------------------------------------------------------------------------
// WaveManager: drives enemy spawning from the wave data. It owns no entities —
// it just decides WHEN to spawn WHAT and calls back into the scene to actually
// create the enemy. The scene asks it each frame to advance.
//
// Lifecycle:
//   startNextWave()  -> builds a flat spawn schedule for the next wave
//   update(delta)    -> fires due spawns via the spawn callback
//   spawning         -> true while a wave still has pending spawns
//   isLastWave / waveNumber / totalWaves -> for HUD + win checks
// ---------------------------------------------------------------------------

export class WaveManager {
  constructor(waves, spawnFn) {
    this.waves = waves;        // array of wave defs for this level
    this.spawnFn = spawnFn;    // (enemyTypeId) => void
    this.waveIndex = -1;       // -1 = no wave started yet
    this.spawning = false;
    this.schedule = [];        // [{ type, at }] times relative to wave start
    this.elapsed = 0;
    this.cursor = 0;
  }

  get totalWaves() {
    return this.waves.length;
  }

  // 1-based number of the current/last-started wave (0 if none yet).
  get waveNumber() {
    return this.waveIndex + 1;
  }

  get isLastWave() {
    return this.waveIndex >= this.waves.length - 1;
  }

  get hasMoreWaves() {
    return this.waveIndex < this.waves.length - 1;
  }

  startNextWave() {
    if (this.spawning || !this.hasMoreWaves) return null;
    this.waveIndex++;
    const wave = this.waves[this.waveIndex];

    // Flatten groups into an absolute-time schedule.
    this.schedule = [];
    for (const group of wave.groups) {
      const delay = group.delay || 0;
      for (let i = 0; i < group.count; i++) {
        this.schedule.push({ type: group.type, at: delay + i * group.interval });
      }
    }
    this.schedule.sort((a, b) => a.at - b.at);

    this.elapsed = 0;
    this.cursor = 0;
    this.spawning = true;
    return wave;
  }

  // Bonus gold for fully clearing the current wave.
  currentWaveReward() {
    const wave = this.waves[this.waveIndex];
    return wave ? wave.reward || 0 : 0;
  }

  update(delta) {
    if (!this.spawning) return;
    this.elapsed += delta;
    while (this.cursor < this.schedule.length && this.schedule[this.cursor].at <= this.elapsed) {
      this.spawnFn(this.schedule[this.cursor].type);
      this.cursor++;
    }
    if (this.cursor >= this.schedule.length) {
      this.spawning = false;
    }
  }
}
