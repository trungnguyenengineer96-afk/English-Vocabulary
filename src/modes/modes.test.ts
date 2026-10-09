import { createRng } from '../core/rng';
import { WORDS, VOCAB } from '../data/words';
import { mismatchMisses } from './memoryFlip';
import { bossHp } from './bossBattle';
import { evolvable } from './wordEvolution';
import { sentenceWords } from './sentenceBuilder';
import { MODES, MODE_BY_ID } from './registry';
import type { BuildContext, ModeId } from './types';

const BRIEF = [
  'Meaning Hunter', 'Word Match', 'Sentence Detective', 'Context Master', 'Odd One Out', 'Context Clues',
  'Spell It', 'Missing Letters', 'Word Scramble', 'Listen & Type', 'Translation Challenge', 'Sentence Builder',
  'Audio Hunter', 'Hear the Meaning', 'Sound Twins', 'Stress Detective', 'Audio Gap', 'Sound Sequence',
  'Flash Recall', 'Picture Quest', 'Word Association', 'Opposite & Similar', 'Collocation Builder', 'Word Evolution',
  'Time Attack', 'Memory Flip', 'Word Maze', 'Combo Streak', 'Boss Battle', 'Ultimate Challenge',
];

const ctx = (seed = 1, audio = true): BuildContext => ({ all: WORDS, rng: createRng(seed), audioAvailable: audio });
const get = (id: ModeId) => MODE_BY_ID.get(id)!;
const e = (id: string) => VOCAB.get(id)!;

describe('mode registry', () => {
  it('implements all 30 modes from the brief, in order, with unique ids', () => {
    expect(MODES.map((m) => m.name)).toEqual(BRIEF);
    expect(new Set(MODES.map((m) => m.id)).size).toBe(30);
  });

  it('each mode has its own component and builder (no reskins)', () => {
    expect(new Set(MODES.map((m) => m.Component)).size).toBe(30);
    expect(new Set(MODES.map((m) => m.build)).size).toBe(30);
  });

  it('skills are balanced: reading 8, writing 7, listening 7, arcade 8', () => {
    const count = (s: string) => MODES.filter((m) => m.skill === s).length;
    expect([count('reading'), count('writing'), count('listening'), count('arcade')]).toEqual([8, 7, 7, 8]);
  });

  it('only listening modes require audio, and they refuse to build without it', () => {
    for (const m of MODES) {
      if (m.requiresAudio) {
        expect(m.skill).toBe('listening');
        expect(m.isEligible(e('apple-n'), { all: WORDS, audioAvailable: false })).toBe(false);
        const targets = WORDS.slice(0, m.targetsPerQuestion);
        expect(m.build(targets, ctx(1, false))).toBeNull();
      }
    }
  });

  it.each(MODES.map((m) => [m.id, m] as const))('%s builds for eligible dataset words', (_id, m) => {
    const eligible = WORDS.filter((w) => m.isEligible(w, { all: WORDS, audioAvailable: true }));
    // Every mode must be playable with the bundled dataset.
    expect(eligible.length).toBeGreaterThanOrEqual(m.targetsPerQuestion > 1 ? m.targetsPerQuestion : 8);
    let built = 0, tried = 0;
    const per = m.targetsPerQuestion;
    for (let i = 0; i + per <= Math.min(eligible.length, 60); i += per) {
      tried++;
      // Spread targets across the list to avoid near-duplicates.
      const group = Array.from({ length: per }, (_, k) => eligible[(i + k * 7) % eligible.length]);
      if (new Set(group.map((g) => g.id)).size < group.length) continue;
      if (m.build(group, ctx(i + 1)) !== null) built++;
    }
    expect(built / tried).toBeGreaterThanOrEqual(0.7);
  });
});

describe('multiple-choice builders', () => {
  const mcq: ModeId[] = ['meaning-hunter', 'context-master', 'context-clues', 'hear-meaning', 'audio-hunter', 'word-association'];
  it.each(mcq)('%s: options include the target once and labels are distinct', (id) => {
    for (const w of WORDS.filter((x) => get(id).isEligible(x, { all: WORDS, audioAvailable: true })).slice(0, 40)) {
      const q = get(id).build([w], ctx(3)) as { options: { key: string; label: string }[] } | null;
      if (!q) continue;
      expect(q.options.filter((o) => o.key === w.id)).toHaveLength(1);
      expect(new Set(q.options.map((o) => o.label)).size).toBe(q.options.length);
      expect(q.options.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('context-master blanks the exact form used in the example', () => {
    const q = get('context-master').build([e('decide-v')], ctx()) as { sentence: string; baseFormNote: boolean };
    expect(q.sentence).toBe('She _____ to study abroad.');
    expect(q.baseFormNote).toBe(true);
  });
});

describe('writing builders', () => {
  it('word scramble tiles are a real permutation that differs from the word', () => {
    for (const w of WORDS.slice(0, 50)) {
      const q = get('word-scramble').build([w], ctx(9)) as { tiles: { text: string }[] } | null;
      if (!q) continue;
      const s = q.tiles.map((t) => t.text).join('');
      expect([...s].sort().join('')).toBe([...w.word].sort().join(''));
      expect(s).not.toBe(w.word);
    }
  });

  it('sentence builder tiles are the sentence words without final punctuation', () => {
    expect(sentenceWords('Can you open the window, please?')).toEqual({
      words: ['Can', 'you', 'open', 'the', 'window,', 'please'], ending: '?',
    });
    const q = get('sentence-builder').build([e('apple-n')], ctx()) as { words: string[]; tiles: { text: string }[] };
    expect(q.tiles.map((t) => t.text).sort()).toEqual([...q.words].sort());
  });

  it('collocation builder uses a real collocation plus two decoys not in it', () => {
    const t = e('deadline-n');
    const q = get('collocation-builder').build([t], ctx(4)) as { phrase: string[]; tiles: { id: string; text: string }[] };
    expect(t.collocations).toContain(q.phrase.join(' '));
    const decoys = q.tiles.filter((x) => x.id.startsWith('d')).map((x) => x.text.toLowerCase());
    expect(decoys).toHaveLength(2);
    for (const d of decoys) expect(q.phrase.map((p) => p.toLowerCase())).not.toContain(d);
  });

  it('word evolution only asks for an unambiguous part of speech', () => {
    expect(evolvable(e('careful-adj')).map((f) => f.word)).toEqual(['care', 'carefully']);
    expect(evolvable(e('advice-n')).map((f) => f.word)).toEqual(['advise']);
    expect(evolvable(e('apple-n'))).toEqual([]);
  });

  it('translation challenge expects the surface form from the sentence', () => {
    const q = get('translation-challenge').build([e('passenger-n')], ctx()) as { expected: string };
    expect(q.expected).toBe('passengers');
  });
});

describe('listening builders', () => {
  it('sound twins uses curated confusables when available', () => {
    let curated = 0;
    for (let s = 1; s < 30; s++) {
      const q = get('sound-twins').build([e('desert-n')], ctx(s)) as { pair: string[]; same: boolean; curated: boolean };
      if (q.same) expect(q.pair).toEqual(['desert', 'desert']);
      else {
        expect(q.pair).toContain('dessert');
        curated++;
      }
    }
    expect(curated).toBeGreaterThan(0);
  });

  it('stress detective requires syllables', () => {
    expect(get('stress-detective').isEligible(e('umbrella-n'), { all: WORDS, audioAvailable: true })).toBe(true);
    expect(get('stress-detective').isEligible(e('cat-n'), { all: WORDS, audioAvailable: true })).toBe(false);
  });

  it('sound sequence includes all targets and two decoys', () => {
    const ts = [e('apple-n'), e('river-n'), e('salary-n')];
    const q = get('sound-sequence').build(ts, ctx()) as { tiles: { id: string }[] };
    expect(q.tiles).toHaveLength(5);
    for (const t of ts) expect(q.tiles.map((x) => x.id)).toContain(t.id);
  });
});

describe('arcade rules', () => {
  it('picture quest only uses entries with pictures', () => {
    const q = get('picture-quest').build([e('apple-n')], ctx()) as { options: { emoji?: string }[] };
    expect(q.options.every((o) => !!o.emoji)).toBe(true);
    expect(get('picture-quest').build([e('decide-v')], ctx())).toBeNull();
  });

  it('memory flip: a mismatch only counts against words whose partner was already seen', () => {
    const cards = [
      { id: 'a:w', pairId: 'a', face: 'word' as const, text: 'a' },
      { id: 'a:m', pairId: 'a', face: 'meaning' as const, text: 'A' },
      { id: 'b:w', pairId: 'b', face: 'word' as const, text: 'b' },
      { id: 'b:m', pairId: 'b', face: 'meaning' as const, text: 'B' },
    ];
    expect(mismatchMisses(cards[0], cards[3], cards, new Set())).toEqual([]);
    expect(mismatchMisses(cards[0], cards[3], cards, new Set(['a:m']))).toEqual(['a']);
    expect(mismatchMisses(cards[0], cards[3], cards, new Set(['a:m', 'b:w']))).toEqual(['a', 'b']);
  });

  it('memory flip and word match refuse boards with overlapping meanings', () => {
    const overlapping = [e('answer-v'), e('reply-v'), e('apple-n')];
    expect(get('memory-flip').build(overlapping, ctx())).toBeNull();
    expect(get('word-match').build(overlapping, ctx())).toBeNull();
  });

  it('time attack mixes true and false statements and scales time with size', () => {
    const ts = WORDS.slice(0, 10);
    const q = get('time-attack').build(ts, ctx(5)) as { items: { isTrue: boolean; shown: string; target: { meaningsVi: string[] } }[]; seconds: number };
    expect(q.seconds).toBe(60);
    expect(q.items.some((i) => i.isTrue) && q.items.some((i) => !i.isTrue)).toBe(true);
    for (const it of q.items) expect(it.shown === it.target.meaningsVi.join(', ')).toBe(it.isTrue);
  });

  it('boss battle hp allows exactly one miss', () => {
    expect(bossHp(5)).toBe(4);
    expect(bossHp(3)).toBe(2);
    const q = get('boss-battle').build(WORDS.slice(40, 45), ctx()) as { challenges: { kind: string }[] };
    expect(new Set(q.challenges.map((c) => c.kind)).size).toBeGreaterThan(1);
  });

  it('ultimate challenge has three different stages', () => {
    const q = get('ultimate-challenge').build([e('decide-v')], ctx()) as { stages: { kind: string }[] };
    expect(q.stages.map((s) => s.kind)).toEqual(['spell', 'context', 'meaning']);
  });
});
