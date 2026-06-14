// ---------------------------------------------------------------------------
// All sound is synthesised at runtime with the Web Audio API — no audio files,
// so it works offline and adds nothing to load time. Each method is a small
// oscillator + gain envelope. Tune freely; add new cues as named methods.
//
// Browsers require a user gesture before audio can start, so the AudioContext
// is created lazily and `unlock()` is wired to the first pointer interaction.
// ---------------------------------------------------------------------------

export class AudioManager {
  constructor(muted = false) {
    this.ctx = null;
    this.master = null;
    this.muted = muted;
  }

  ensureContext() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return; // audio simply unavailable; game still plays
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
  }

  // Call from a user gesture (pointerdown) to satisfy autoplay policies.
  unlock() {
    this.ensureContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.muted = !!muted;
    return this.muted;
  }

  // Core synth: a tone that sweeps from freq -> endFreq over `dur` seconds.
  tone({ freq = 440, endFreq = freq, type = 'sine', dur = 0.12, gain = 0.6, delay = 0 }) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;

    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + dur);

    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(env);
    env.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // ---- Named game cues -------------------------------------------------

  shoot() {
    this.tone({ freq: 720, endFreq: 480, type: 'square', dur: 0.08, gain: 0.18 });
  }

  // Rising "powering up" hum when a charge begins.
  charge() {
    this.tone({ freq: 160, endFreq: 520, type: 'sawtooth', dur: 0.5, gain: 0.12 });
  }

  // Sharp beam discharge.
  laser() {
    this.tone({ freq: 1400, endFreq: 320, type: 'sawtooth', dur: 0.16, gain: 0.22 });
    this.tone({ freq: 2400, endFreq: 1200, type: 'sine', dur: 0.08, gain: 0.12 });
  }

  hit() {
    this.tone({ freq: 320, endFreq: 200, type: 'triangle', dur: 0.06, gain: 0.2 });
  }

  explode() {
    this.tone({ freq: 180, endFreq: 60, type: 'sawtooth', dur: 0.22, gain: 0.3 });
  }

  place() {
    this.tone({ freq: 440, endFreq: 660, type: 'sine', dur: 0.12, gain: 0.3 });
    this.tone({ freq: 660, endFreq: 880, type: 'sine', dur: 0.12, gain: 0.2, delay: 0.06 });
  }

  deny() {
    this.tone({ freq: 200, endFreq: 140, type: 'square', dur: 0.14, gain: 0.25 });
  }

  // Alarm-ish double thud when an enemy slips through and reaches the base.
  baseHit() {
    this.tone({ freq: 220, endFreq: 70, type: 'sawtooth', dur: 0.22, gain: 0.3 });
    this.tone({ freq: 300, endFreq: 90, type: 'square', dur: 0.16, gain: 0.18, delay: 0.06 });
  }

  // Soft blip when a placed tower is tapped/selected.
  select() {
    this.tone({ freq: 560, endFreq: 760, type: 'sine', dur: 0.07, gain: 0.18 });
  }

  // Descending chime when a tower is sold (gold back).
  sell() {
    this.tone({ freq: 880, endFreq: 520, type: 'triangle', dur: 0.12, gain: 0.25 });
    this.tone({ freq: 520, endFreq: 360, type: 'triangle', dur: 0.12, gain: 0.18, delay: 0.07 });
  }

  waveStart() {
    this.tone({ freq: 300, endFreq: 500, type: 'sawtooth', dur: 0.2, gain: 0.25 });
  }

  win() {
    [523, 659, 784, 1047].forEach((f, i) =>
      this.tone({ freq: f, type: 'triangle', dur: 0.22, gain: 0.3, delay: i * 0.12 }));
  }

  lose() {
    [392, 311, 233, 174].forEach((f, i) =>
      this.tone({ freq: f, type: 'sawtooth', dur: 0.28, gain: 0.3, delay: i * 0.14 }));
  }
}
