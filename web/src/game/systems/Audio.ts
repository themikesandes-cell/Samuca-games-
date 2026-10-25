// Retro sound effects and an original 16-bit style samba-pop loop, all synthesised with
// the Web Audio API (no audio files, nothing to break). The context is only created /
// resumed inside a user gesture, as Safari on iPhone requires.

import { storage } from '../storage';
import { ASSET_BASE } from '../assets';

/** soundtrack file in public/assets; if it fails to load the built-in chiptune plays instead */
const TRACK_URL = `${ASSET_BASE}music.mp3`;

/** 0.1 s of silence (8-bit mono WAV) used to unlock iOS media playback */
const SILENT_WAV = (() => {
  const n = 800;
  const bytes = new Uint8Array(44 + n);
  const v = new DataView(bytes.buffer);
  const str = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, n, true);
  bytes.fill(128, 44);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(bin)}`;
})();

type Wave = OscillatorType;

const STEP = 60 / 132 / 4; // 16th note at 132 bpm
const BAR = 16;

// ---- song data (MIDI notes) --------------------------------------------------------
const CHORDS: number[][] = [
  [60, 64, 67], // C
  [57, 60, 64], // Am
  [62, 65, 69], // Dm
  [55, 59, 62], // G
  [60, 64, 67], // C
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [55, 59, 62], // G
];
const BASS_ROOT = [36, 33, 38, 31, 36, 33, 29, 31];

// [step, midi, length in steps]
const MELODY: [number, number, number][][] = [
  [[0, 76, 2], [2, 79, 2], [4, 81, 1], [5, 79, 2], [7, 76, 2], [10, 72, 1], [11, 74, 2], [13, 76, 3]],
  [[0, 72, 2], [2, 76, 2], [4, 81, 2], [6, 79, 1], [7, 76, 3], [11, 74, 1], [12, 72, 4]],
  [[0, 74, 2], [2, 77, 2], [4, 81, 1], [5, 84, 2], [7, 81, 2], [10, 77, 1], [11, 79, 2], [13, 81, 3]],
  [[0, 83, 2], [2, 81, 1], [3, 79, 2], [5, 77, 2], [7, 74, 3], [12, 79, 2], [14, 83, 2]],
  [[0, 84, 2], [2, 83, 1], [3, 81, 2], [5, 79, 3], [10, 76, 1], [11, 79, 2], [13, 84, 3]],
  [[0, 81, 2], [2, 79, 1], [3, 76, 2], [5, 72, 3], [10, 74, 1], [11, 76, 2], [13, 77, 3]],
  [[0, 77, 2], [2, 81, 2], [4, 84, 2], [6, 81, 1], [7, 77, 2], [10, 79, 1], [11, 81, 2], [13, 79, 3]],
  [[0, 79, 2], [2, 77, 1], [3, 76, 2], [5, 74, 2], [8, 71, 2], [10, 74, 2], [12, 79, 4]],
];
const TAMBORIM = [0, 2, 5, 7, 8, 10, 13];
const STABS = [2, 6, 11, 14];
const HAT_VOL = [0.55, 0.22, 0.35, 0.22];

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private noise!: AudioBuffer;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private playing = false;
  private track: AudioBuffer | null = null;
  private trackLoading = false;
  private trackBytes: Promise<ArrayBuffer> | null = null;

  /** download the song early (no gesture needed); decoding waits for the unlock */
  prefetch(): Promise<ArrayBuffer> {
    if (!this.trackBytes) {
      this.trackBytes = fetch(TRACK_URL).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))));
      this.trackBytes.catch(() => {
        this.trackBytes = null;
      });
    }
    return this.trackBytes;
  }
  private trackSrc: AudioBufferSourceNode | null = null;
  private trackGain!: GainNode;
  private trackOffset = 0; // seconds into the song (kept across pauses)
  private trackStartedAt = 0;

  musicOn = storage.getFlag('music', true);
  sfxOn = storage.getFlag('sfx', true);

  /** Must be called from a user gesture. Safe to call many times. */
  unlock(): void {
    try {
      this.forcePlaybackSession();
      if (!this.ctx) {
        const AC: typeof AudioContext | undefined =
          window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this.musicOn ? 0.28 : 0;
        this.musicGain.connect(this.master);
        this.trackGain = this.ctx.createGain();
        this.trackGain.gain.value = 2.2; // the mp3 sits under the same music on/off gain
        this.trackGain.connect(this.musicGain);
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = this.sfxOn ? 0.55 : 0;
        this.sfxGain.connect(this.master);
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        // iOS: play a silent buffer inside the gesture to fully unlock output
        const src = this.ctx.createBufferSource();
        src.buffer = this.ctx.createBuffer(1, 1, 22050);
        src.connect(this.ctx.destination);
        src.start(0);
      }
      if (this.ctx.state !== 'running') void this.ctx.resume();
      this.loadTrack();
    } catch {
      this.ctx = null;
    }
  }

  private sessionForced = false;

  /**
   * iPhone: Web Audio is muted by the silent (ring/mute) switch unless the page uses the
   * "playback" audio session. Safari 16.4+ exposes navigator.audioSession; older iOS needs
   * a looping silent <audio> element started inside a gesture to switch the category.
   */
  private forcePlaybackSession(): void {
    if (this.sessionForced) return;
    this.sessionForced = true;
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = 'playback';
    } catch {
      /* ignore */
    }
    try {
      const el = document.createElement('audio');
      el.setAttribute('x-webkit-airplay', 'deny');
      el.preload = 'auto';
      el.loop = true;
      el.src = SILENT_WAV;
      el.volume = 0.01;
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => (this.sessionForced = false));
    } catch {
      this.sessionForced = false;
    }
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    storage.setFlag('music', on);
    if (this.ctx) this.musicGain.gain.setTargetAtTime(on ? 0.28 : 0, this.ctx.currentTime, 0.05);
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    storage.setFlag('sfx', on);
    if (this.ctx) this.sfxGain.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.02);
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // ---------------------------------------------------------------- music
  private loadTrack(): void {
    if (this.track || this.trackLoading || !this.ctx) return;
    this.trackLoading = true;
    const ctx = this.ctx;
    (this.trackBytes ?? this.prefetch())
      .then((bytes) => bytes.slice(0))
      .then(
        (data) =>
          new Promise<AudioBuffer>((resolve, reject) => {
            // callback form for older Safari
            const p = ctx.decodeAudioData(data, resolve, reject);
            if (p && typeof p.then === 'function') p.then(resolve, reject);
          }),
      )
      .then((buf) => {
        this.track = buf;
        // song arrived while the chiptune fallback was playing: switch over
        if (this.playing && this.timer !== null) {
          this.stopChip();
          this.playTrack();
        }
      })
      .catch(() => {
        /* keep the chiptune */
      })
      .finally(() => {
        this.trackLoading = false;
      });
  }

  /** `restart` = play the song from the beginning (new run); otherwise continue after a pause */
  startMusic(restart = false): void {
    if (restart) this.trackOffset = 0;
    if (this.playing) return;
    this.playing = true;
    if (this.track && this.ctx) {
      this.playTrack();
      return;
    }
    this.step = 0;
    this.nextTime = this.ctx ? this.ctx.currentTime + 0.08 : 0;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private playTrack(): void {
    if (!this.ctx || !this.track) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.track;
    src.loop = true;
    src.connect(this.trackGain);
    const offset = this.trackOffset % this.track.duration;
    src.start(0, offset);
    this.trackStartedAt = this.ctx.currentTime - offset;
    this.trackSrc = src;
  }

  private stopChip(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  stopMusic(): void {
    this.playing = false;
    this.stopChip();
    if (this.trackSrc && this.ctx && this.track) {
      this.trackOffset = (this.ctx.currentTime - this.trackStartedAt) % this.track.duration;
      try {
        this.trackSrc.stop();
      } catch {
        /* already stopped */
      }
      this.trackSrc.disconnect();
    }
    this.trackSrc = null;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05; // after a pause
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step = (this.step + 1) % (BAR * 8);
    }
  }

  private playStep(step: number, t: number): void {
    const bar = Math.floor(step / BAR);
    const s = step % BAR;
    const out = this.musicGain;
    // melody (skip on the very first loop's bars 0-1 for a little intro? keep it simple)
    for (const [ns, note, len] of MELODY[bar]) {
      if (ns === s) this.tone(out, 'square', mtof(note), t, len * STEP * 0.9, 0.12, 0.004, 0.6);
    }
    // bass: samba pattern root / fifth
    const root = BASS_ROOT[bar];
    const bassPat: Record<number, number> = { 0: root, 3: root, 4: root + 7, 8: root, 11: root, 12: root + 7, 14: root + 12 };
    if (bassPat[s] !== undefined) this.tone(out, 'triangle', mtof(bassPat[s] + 12), t, STEP * 1.6, 0.32, 0.003, 0.5);
    // chord stabs
    if (STABS.includes(s)) for (const n of CHORDS[bar]) this.tone(out, 'square', mtof(n + 12), t, STEP * 0.6, 0.028, 0.002, 0.3);
    // drums
    if (s === 0 || s === 8) this.kick(out, t, 0.6);
    if (s === 6 || s === 14) this.kick(out, t, 0.25);
    if (s === 4 || s === 12) this.surdo(out, t);
    this.hat(out, t, HAT_VOL[s % 4] * 0.5);
    if (TAMBORIM.includes(s)) this.tone(out, 'square', 1250, t, 0.025, 0.05, 0.001, 0.01);
  }

  // ---------------------------------------------------------------- synth helpers
  private tone(dest: AudioNode, wave: Wave, freq: number, t: number, dur: number, vol: number, attack = 0.005, sustain = 0.7, slideTo?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol * sustain, t + Math.max(attack, dur * 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseHit(dest: AudioNode, t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, freqTo?: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private kick(dest: AudioNode, t: number, vol: number): void {
    this.tone(dest, 'sine', 140, t, 0.16, vol, 0.002, 0.8, 45);
  }

  private surdo(dest: AudioNode, t: number): void {
    this.tone(dest, 'sine', 95, t, 0.3, 0.45, 0.004, 0.8, 60);
  }

  private hat(dest: AudioNode, t: number, vol: number): void {
    this.noiseHit(dest, t, 0.035, vol * 0.35, 'highpass', 7000);
  }

  // ---------------------------------------------------------------- sfx
  private sfx(fn: (t: number, out: GainNode) => void): void {
    if (!this.ctx || this.ctx.state !== 'running' || !this.sfxOn) return;
    fn(this.ctx.currentTime + 0.005, this.sfxGain);
  }

  jump(): void {
    this.sfx((t, o) => this.tone(o, 'square', 320, t, 0.14, 0.16, 0.003, 0.7, 760));
  }

  coin(): void {
    this.sfx((t, o) => {
      this.tone(o, 'square', 988, t, 0.06, 0.13, 0.002, 0.9);
      this.tone(o, 'square', 1319, t + 0.055, 0.2, 0.13, 0.002, 0.7);
    });
  }

  slide(): void {
    this.sfx((t, o) => this.noiseHit(o, t, 0.22, 0.32, 'lowpass', 2400, 300));
  }

  land(): void {
    this.sfx((t, o) => this.noiseHit(o, t, 0.06, 0.25, 'lowpass', 600));
  }

  hit(): void {
    this.sfx((t, o) => {
      this.noiseHit(o, t, 0.35, 0.6, 'lowpass', 1800, 120);
      this.tone(o, 'square', 220, t, 0.4, 0.18, 0.002, 0.8, 50);
    });
  }

  click(): void {
    this.sfx((t, o) => this.tone(o, 'square', 660, t, 0.05, 0.1, 0.002, 0.8));
  }

  record(): void {
    this.sfx((t, o) => {
      [72, 76, 79, 84].forEach((n, i) => this.tone(o, 'square', mtof(n), t + i * 0.08, 0.14, 0.12, 0.002, 0.8));
    });
  }

  gameOver(): void {
    this.sfx((t, o) => {
      [67, 64, 60, 55].forEach((n, i) => this.tone(o, 'triangle', mtof(n), t + 0.25 + i * 0.13, 0.2, 0.25, 0.002, 0.8));
    });
  }
}

export const audio = new AudioEngine();
