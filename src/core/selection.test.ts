import { DAY_MS } from './dates';
import { applyAnswer, newLibraryItem } from './scheduler';
import { apportion, categorize, selectForReview, DEFAULT_WEIGHTS } from './selection';
import type { LibraryItem } from './types';

const NOW = new Date(2026, 5, 10, 10, 0, 0).getTime();

function make(id: string, kind: 'mistake' | 'due' | 'weak' | 'strong'): LibraryItem {
  let i = newLibraryItem(id, NOW - 30 * DAY_MS, 'daily');
  const g = (r: 'correct' | 'wrong', at: number) =>
    (i = applyAnswer(i, { result: r, now: at, mode: 'm', skill: 'reading' }));
  switch (kind) {
    case 'mistake':
      g('wrong', NOW - DAY_MS);
      break;
    case 'due':
      g('correct', NOW - 20 * DAY_MS);
      g('correct', NOW - 19 * DAY_MS);
      g('correct', NOW - 16 * DAY_MS); // interval ≥ 3 → due before NOW
      i = { ...i, dueAt: NOW - DAY_MS };
      break;
    case 'weak':
      g('correct', NOW - 2 * DAY_MS); // confidence 0.2, due tomorrow-ish
      i = { ...i, dueAt: NOW + 2 * DAY_MS };
      break;
    case 'strong':
      i = { ...i, history: [{ at: NOW - DAY_MS, mode: 'm', skill: 'reading', result: 'correct' }], lastResult: 'correct',
        confidence: 0.9, reps: 5, dueAt: NOW + 10 * DAY_MS, state: 'mastered' };
      break;
  }
  return i;
}

function lib(spec: Record<'mistake' | 'due' | 'weak' | 'strong', number>) {
  const out: Record<string, LibraryItem> = {};
  for (const [k, n] of Object.entries(spec) as [keyof typeof spec, number][]) {
    for (let j = 0; j < n; j++) {
      const id = `${k}-${String(j).padStart(2, '0')}`;
      out[id] = make(id, k);
    }
  }
  return out;
}

describe('categorize', () => {
  it('assigns each item to its first matching category', () => {
    expect(categorize(make('a', 'mistake'), NOW)).toBe('mistakes');
    expect(categorize(make('a', 'due'), NOW)).toBe('due');
    expect(categorize(make('a', 'weak'), NOW)).toBe('weak');
    expect(categorize(make('a', 'strong'), NOW)).toBe('reinforcement');
  });
});

describe('apportion', () => {
  it('splits 20 as 8/6/4/2 by default', () => {
    expect(apportion(20, DEFAULT_WEIGHTS)).toEqual({ mistakes: 8, due: 6, weak: 4, reinforcement: 2 });
  });
  it('always sums to n', () => {
    for (let n = 0; n <= 37; n++) {
      const a = apportion(n, { mistakes: 3, due: 7, weak: 1, reinforcement: 5 });
      expect(a.mistakes + a.due + a.weak + a.reinforcement).toBe(n);
    }
  });
  it('treats weights as tunable', () => {
    expect(apportion(10, { mistakes: 0, due: 100, weak: 0, reinforcement: 0 })).toEqual({
      mistakes: 0, due: 10, weak: 0, reinforcement: 0,
    });
  });
});

describe('selectForReview', () => {
  it('meets the 40/30/20/10 target when every category has enough words', () => {
    const r = selectForReview(lib({ mistake: 10, due: 10, weak: 10, strong: 10 }), { size: 20, now: NOW });
    expect(r.ids.length).toBe(20);
    expect(new Set(r.ids).size).toBe(20);
    expect(r.taken).toEqual({ mistakes: 8, due: 6, weak: 4, reinforcement: 2 });
    expect(r.short).toBe(false);
  });

  it('fills a short category from others, highest priority first', () => {
    const r = selectForReview(lib({ mistake: 2, due: 20, weak: 20, strong: 20 }), { size: 20, now: NOW });
    expect(r.ids.length).toBe(20);
    expect(r.taken.mistakes).toBe(2);
    // the 6 missing mistake slots go to "due" first
    expect(r.taken.due).toBe(12);
    expect(r.taken.weak).toBe(4);
    expect(r.taken.reinforcement).toBe(2);
  });

  it('never fabricates: a small library yields a shorter test of distinct words', () => {
    const r = selectForReview(lib({ mistake: 1, due: 2, weak: 1, strong: 3 }), { size: 20, now: NOW });
    expect(r.ids.length).toBe(7);
    expect(new Set(r.ids).size).toBe(7);
    expect(r.short).toBe(true);
  });

  it('respects exclusions and manual "only" sets', () => {
    const l = lib({ mistake: 5, due: 5, weak: 5, strong: 5 });
    const ex = selectForReview(l, { size: 20, now: NOW, exclude: new Set(['mistake-00', 'due-00']) });
    expect(ex.ids).not.toContain('mistake-00');
    expect(ex.ids).not.toContain('due-00');
    const only = selectForReview(l, { size: 20, now: NOW, only: new Set(['weak-01', 'strong-02']) });
    expect(only.ids.sort()).toEqual(['strong-02', 'weak-01']);
  });

  it('orders mistakes by recency of the miss', () => {
    const l = lib({ mistake: 3, due: 0, weak: 0, strong: 0 });
    l['mistake-02'] = { ...l['mistake-02'], lastMissAt: NOW - 1000 };
    const r = selectForReview(l, { size: 1, now: NOW });
    expect(r.ids).toEqual(['mistake-02']);
  });

  it('is deterministic for a given seed', () => {
    const l = lib({ mistake: 3, due: 3, weak: 3, strong: 15 });
    const a = selectForReview(l, { size: 12, now: NOW, seed: 42 });
    const b = selectForReview(l, { size: 12, now: NOW, seed: 42 });
    expect(a.ids).toEqual(b.ids);
  });
});
