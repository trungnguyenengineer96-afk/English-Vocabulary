// Sound effects synthesised with the Web Audio API: no audio files, no licensing,
// tiny and instant. Short, soft sounds — feedback, not noise.

export type SoundName = 'tap' | 'flip' | 'correct' | 'wrong' | 'next' | 'combo' | 'fanfare' | 'complete' | 'achievement';

let ctx: AudioContext | null = null;
let enabled = true;
let volume = 0.6;

export function configureSfx(opts: { enabled: boolean; volume: number }) {
  enabled = opts.enabled;
  volume = Math.min(1, Math.max(0, opts.volume));
}

function audio(): AudioContext | null {
  if (!enabled || volume <= 0 || typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
  attack?: number;
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, o: ToneOpts = {}) {
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
  const peak = (o.gain ?? 0.25) * volume;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack ?? 0.006));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function whoosh(ac: AudioContext, dur = 0.18) {
  const t0 = ac.currentTime;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(500, t0);
  bp.frequency.exponentialRampToValueAtTime(2600, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.12 * volume, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(g).connect(ac.destination);
  src.start(t0);
}

const semis = (base: number, n: number) => base * 2 ** (n / 12);

/** Play a sound effect. `level` raises the pitch of combo sounds. Never throws. */
export function playSfx(name: SoundName, level = 0): void {
  const ac = audio();
  if (!ac) return;
  try {
    switch (name) {
      case 'tap':
        tone(ac, 660, 0, 0.06, { type: 'triangle', gain: 0.12 });
        break;
      case 'flip':
        tone(ac, 520, 0, 0.08, { type: 'triangle', gain: 0.12, slideTo: 820 });
        break;
      case 'correct':
        tone(ac, 880, 0, 0.11, { type: 'triangle', gain: 0.2 });
        tone(ac, 1318.5, 0.08, 0.22, { type: 'sine', gain: 0.22 });
        break;
      case 'wrong':
        // Low and soft: tells you, without punishing.
        tone(ac, 260, 0, 0.22, { type: 'sine', gain: 0.2, slideTo: 175 });
        tone(ac, 196, 0.05, 0.25, { type: 'triangle', gain: 0.08 });
        break;
      case 'next':
        whoosh(ac);
        break;
      case 'combo': {
        const base = semis(523.25, Math.min(level, 12));
        [0, 4, 7, 12].forEach((s, i) => tone(ac, semis(base, s), i * 0.06, 0.14, { type: 'square', gain: 0.06 }));
        break;
      }
      case 'fanfare':
        [523.25, 659.25, 783.99].forEach((f, i) => tone(ac, f, i * 0.11, 0.16, { type: 'triangle', gain: 0.2 }));
        tone(ac, 1046.5, 0.33, 0.5, { type: 'triangle', gain: 0.22 });
        tone(ac, 783.99, 0.33, 0.5, { type: 'sine', gain: 0.12 });
        break;
      case 'complete':
        tone(ac, 659.25, 0, 0.14, { type: 'triangle', gain: 0.18 });
        tone(ac, 783.99, 0.12, 0.3, { type: 'sine', gain: 0.18 });
        break;
      case 'achievement':
        [1568, 2093, 2637, 3136].forEach((f, i) => tone(ac, f, i * 0.07, 0.25, { type: 'sine', gain: 0.1 }));
        break;
    }
  } catch {
    /* audio is decoration; never break the app */
  }
}
