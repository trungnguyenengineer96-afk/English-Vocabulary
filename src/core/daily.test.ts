import { WORDS } from '../data/words';
import { quotas, selectDaily, TOPIC_CAP_SHARE } from './daily';
import type { VocabEntry } from './types';

const indexOf = new Map(WORDS.map((w, i) => [w.id, i]));
const byId = new Map(WORDS.map((w) => [w.id, w]));

function checkConstraints(ids: string[], goal: number) {
  const entries = ids.map((id) => byId.get(id)!);
  expect(new Set(ids).size).toBe(ids.length);
  expect(new Set(entries.map((e) => e.word.toLowerCase())).size).toBe(ids.length);
  const idx = ids.map((id) => indexOf.get(id)!).sort((a, b) => a - b);
  for (let k = 1; k < idx.length; k++) expect(idx[k] - idx[k - 1]).toBeGreaterThan(1);
  const topics = new Map<string, number>();
  for (const e of entries) topics.set(e.tags[0], (topics.get(e.tags[0]) ?? 0) + 1);
  for (const n of topics.values()) expect(n).toBeLessThanOrEqual(Math.ceil(goal * TOPIC_CAP_SHARE));
  for (const a of entries)
    for (const b of entries)
      if (a !== b) expect((a.synonyms ?? []).map((s) => s.toLowerCase())).not.toContain(b.word.toLowerCase());
}

describe('quotas', () => {
  it('sums to the goal for every level', () => {
    for (const goal of [7, 10, 20, 30])
      for (const level of ['beginner', 'intermediate', 'advanced'] as const)
        expect(quotas(goal, level).reduce((a, b) => a + b, 0)).toBe(goal);
  });
});

describe('selectDaily', () => {
  it.each([7, 10, 20, 30])('picks %i words satisfying all constraints across many seeds', (goal) => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = selectDaily(WORDS, { goal, level: 'intermediate', seed, exclude: new Set() });
      expect(r.ids.length).toBe(goal);
      expect(r.relaxed).toEqual([]);
      checkConstraints(r.ids, goal);
    }
  });

  it('balances difficulty by level', () => {
    const avg = (level: 'beginner' | 'advanced') => {
      let sum = 0, n = 0;
      for (let seed = 1; seed <= 20; seed++) {
        for (const id of selectDaily(WORDS, { goal: 20, level, seed, exclude: new Set() }).ids) {
          sum += byId.get(id)!.difficulty;
          n++;
        }
      }
      return sum / n;
    };
    expect(avg('beginner')).toBeLessThan(2.3);
    expect(avg('advanced')).toBeGreaterThan(3.5);
  });

  it('prefers frequent words on average', () => {
    let picked = 0, n = 0;
    for (let seed = 1; seed <= 30; seed++)
      for (const id of selectDaily(WORDS, { goal: 10, level: 'intermediate', seed, exclude: new Set() }).ids) {
        picked += byId.get(id)!.frequency;
        n++;
      }
    const base = WORDS.reduce((s, w) => s + w.frequency, 0) / WORDS.length;
    expect(picked / n).toBeGreaterThan(base);
  });

  it('is deterministic per seed and excludes library words', () => {
    const a = selectDaily(WORDS, { goal: 10, level: 'intermediate', seed: 7, exclude: new Set() });
    const b = selectDaily(WORDS, { goal: 10, level: 'intermediate', seed: 7, exclude: new Set() });
    expect(a.ids).toEqual(b.ids);
    const exclude = new Set(a.ids);
    const c = selectDaily(WORDS, { goal: 10, level: 'intermediate', seed: 7, exclude });
    expect(c.ids.some((id) => exclude.has(id))).toBe(false);
  });

  it('tops up an existing plan, keeping existing words first', () => {
    const first = selectDaily(WORDS, { goal: 7, level: 'beginner', seed: 3, exclude: new Set() });
    const more = selectDaily(WORDS, { goal: 20, level: 'beginner', seed: 4, exclude: new Set(), existing: first.ids });
    expect(more.ids.slice(0, 7)).toEqual(first.ids);
    expect(more.ids.length).toBe(20);
    checkConstraints(more.ids, 20);
  });

  it('relaxes constraints in order only when the pool is too small, never duplicating', () => {
    const tiny: VocabEntry[] = WORDS.slice(0, 12).map((w) => ({ ...w, tags: ['same'] }));
    const r = selectDaily(tiny, { goal: 10, level: 'beginner', seed: 1, exclude: new Set() });
    expect(r.relaxed[0]).toBe('topic-cap');
    expect(r.relaxed).toContain('adjacency');
    expect(new Set(r.ids).size).toBe(r.ids.length);
    expect(r.ids.length).toBe(10);
  });

  it('returns fewer words when the dataset is exhausted', () => {
    const exclude = new Set(WORDS.slice(3).map((w) => w.id));
    const r = selectDaily(WORDS, { goal: 10, level: 'beginner', seed: 1, exclude });
    expect(r.ids.length).toBe(3);
  });
});
