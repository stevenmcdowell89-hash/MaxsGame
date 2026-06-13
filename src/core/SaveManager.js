// ---------------------------------------------------------------------------
// Persistence via localStorage. All reads/writes are funnelled through here so
// the storage schema lives in one place and can be versioned/migrated.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'maxsgame.towerdefense.v1';

const DEFAULTS = {
  version: 1,
  bestWave: 0, // furthest wave cleared across all runs
  wins: 0,
  muted: false,
};

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const data = JSON.parse(raw);
    return { ...DEFAULTS, ...data };
  } catch (e) {
    // Corrupt or unavailable storage: fail soft with defaults.
    console.warn('SaveManager: could not read save, using defaults.', e);
    return { ...DEFAULTS };
  }
}

function write(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('SaveManager: could not write save.', e);
  }
}

export const SaveManager = {
  load() {
    return read();
  },

  getBestWave() {
    return read().bestWave;
  },

  isMuted() {
    return read().muted;
  },

  setMuted(muted) {
    const data = read();
    data.muted = !!muted;
    write(data);
    return data.muted;
  },

  // Record the outcome of a run. wavesCleared = number of fully-cleared waves.
  recordResult({ win, wavesCleared }) {
    const data = read();
    if (typeof wavesCleared === 'number' && wavesCleared > data.bestWave) {
      data.bestWave = wavesCleared;
    }
    if (win) data.wins += 1;
    write(data);
    return data;
  },
};
