import { configureSfx, playSfx, type SoundName } from './sfx';

class FakeParam {
  setValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  value = 0;
}
class FakeNode {
  frequency = new FakeParam();
  gain = new FakeParam();
  Q = new FakeParam();
  type = '';
  buffer: unknown = null;
  connect(n: unknown) { return n; }
  start() {}
  stop() {}
}
let created = 0;
class FakeAudioContext {
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination = new FakeNode();
  createOscillator() { created++; return new FakeNode(); }
  createGain() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createBufferSource() { created++; return new FakeNode(); }
  createBuffer(_c: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
  resume() { return Promise.resolve(); }
}

const ALL: SoundName[] = ['tap', 'flip', 'correct', 'wrong', 'next', 'combo', 'fanfare', 'complete', 'achievement'];

describe('sound effects', () => {
  afterEach(() => {
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
  });

  it('is silent and safe without Web Audio', () => {
    configureSfx({ enabled: true, volume: 1 });
    for (const n of ALL) expect(() => playSfx(n)).not.toThrow();
  });

  it('every sound schedules audio nodes when enabled', () => {
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
    configureSfx({ enabled: true, volume: 0.5 });
    for (const n of ALL) {
      const before = created;
      playSfx(n, 4);
      expect(created).toBeGreaterThan(before);
    }
  });

  it('plays nothing when turned off or at zero volume', () => {
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
    configureSfx({ enabled: false, volume: 1 });
    const before = created;
    playSfx('correct');
    configureSfx({ enabled: true, volume: 0 });
    playSfx('correct');
    expect(created).toBe(before);
  });
});
