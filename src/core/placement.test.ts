import { WORDS } from '../data/words';
import { createRng } from './rng';
import {
  MAX_ITEMS, applyPlacement, cefrOf, estimate, kindFor, pCorrect, pKnow, pickItem, shouldStop, summarize,
} from './placement';
import { defaultData } from './storage';
import type { PlacementAnswer, PlacementKind } from './types';

const NOW = new Date(2026, 9, 9, 9).getTime();
const ans = (difficulty: number, result: PlacementAnswer['result'], kind: PlacementKind = 'meaning', vocabId = `w${difficulty}`): PlacementAnswer =>
  ({ vocabId, difficulty, kind, result });

/** Simulate a learner with true ability `trueTheta` answering deterministically by expected knowledge. */
function simulate(trueTheta: number, seed = 1, audio = true) {
  const rng = createRng(seed);
  const answers: PlacementAnswer[] = [];
  const used = new Set<string>();
  let est = { theta: 2.5, se: 9 };
  while (!shouldStop(answers.length, est.se)) {
    const kind = kindFor(answers.length, est.theta, audio);
    const w = pickItem(WORDS, used, est.theta, kind, rng)!;
    used.add(w.id);
    const p = pKnow(trueTheta, w.difficulty);
    const r = rng();
    const result = r < p ? 'correct' : kind !== 'spelling' && r < p + (1 - p) * 0.25 ? 'correct' : r < 0.9 ? 'unsure' : 'wrong';
    answers.push({ vocabId: w.id, difficulty: w.difficulty, kind, result });
    est = estimate(answers);
  }
  return { answers, est };
}

describe('placement model', () => {
  it('guessing raises the floor of multiple choice but not of typing', () => {
    expect(pCorrect(-5, 5, 'meaning')).toBeCloseTo(0.25, 2);
    expect(pCorrect(-5, 5, 'spelling')).toBeCloseTo(0, 2);
    expect(pKnow(3, 3)).toBeCloseTo(0.5, 5);
  });

  it('all correct → C1, all unsure → A1, with a fair middle', () => {
    const allRight = [1, 2, 3, 4, 5, 5, 5, 5].map((d) => ans(d, 'correct'));
    const allUnsure = [1, 1, 2, 2, 3, 3].map((d) => ans(d, 'unsure'));
    expect(cefrOf(estimate(allRight).theta)).toBe('C1');
    expect(cefrOf(estimate(allUnsure).theta)).toBe('A1');
    const mid = [ans(1, 'correct'), ans(2, 'correct'), ans(2, 'correct'), ans(3, 'correct'), ans(3, 'wrong'), ans(4, 'unsure'), ans(4, 'wrong'), ans(5, 'unsure')];
    expect(cefrOf(estimate(mid).theta)).toBe('B1');
  });

  it('"I don\'t know" is never penalised more than a wrong answer, and a lucky guess would inflate the estimate', () => {
    const base = [ans(2, 'correct'), ans(3, 'correct')];
    expect(estimate([...base, ans(4, 'unsure')]).theta).toBe(estimate([...base, ans(4, 'wrong')]).theta);
    expect(estimate([...base, ans(4, 'correct')]).theta).toBeGreaterThan(estimate([...base, ans(4, 'unsure')]).theta);
  });

  it('the estimate grows more certain with more answers', () => {
    const few = estimate([ans(3, 'correct'), ans(3, 'wrong')]);
    const many = estimate(Array.from({ length: 16 }, (_, i) => ans(3, i % 2 ? 'correct' : 'wrong')));
    expect(many.se).toBeLessThan(few.se);
  });

  it('stops between the minimum and maximum number of items', () => {
    expect(shouldStop(11, 0.1)).toBe(false);
    expect(shouldStop(12, 0.29)).toBe(true);
    expect(shouldStop(15, 0.5)).toBe(false);
    expect(shouldStop(MAX_ITEMS, 0.9)).toBe(true);
  });

  it.each([
    [1.0, ['A1', 'A2']],
    [3.0, ['A2', 'B1', 'B2']],
    [5.0, ['B2', 'C1']],
  ])('simulated learner with θ=%s is placed near their level', (theta, ok) => {
    for (let seed = 1; seed <= 6; seed++) {
      const { answers, est } = simulate(theta as number, seed);
      expect(answers.length).toBeGreaterThanOrEqual(12);
      expect(answers.length).toBeLessThanOrEqual(MAX_ITEMS);
      expect(ok).toContain(cefrOf(est.theta));
    }
  });

  it('never repeats a word and adapts difficulty to the estimate', () => {
    const { answers } = simulate(4.5, 3);
    expect(new Set(answers.map((a) => a.vocabId)).size).toBe(answers.length);
    const late = answers.slice(-5).reduce((s, a) => s + a.difficulty, 0) / 5;
    expect(late).toBeGreaterThan(3.3);
  });

  it('uses spelling, context and (with audio) listening items; no listening without audio', () => {
    const kinds = Array.from({ length: 16 }, (_, i) => kindFor(i, 3, true));
    expect(kinds).toContain('spelling');
    expect(kinds).toContain('context');
    expect(kinds).toContain('listening');
    expect(Array.from({ length: 16 }, (_, i) => kindFor(i, 3, false))).not.toContain('listening');
  });

  it('spelling items target an easier band and only simple words', () => {
    const rng = createRng(1);
    for (let i = 0; i < 20; i++) {
      const w = pickItem(WORDS, new Set(), 3.0, 'spelling', rng)!;
      expect(w.word).toMatch(/^[a-z]{3,10}$/);
      expect(w.difficulty).toBe(2);
    }
  });

  it('summary reports per-skill scores and the weakest skill', () => {
    const answers: PlacementAnswer[] = [
      ans(3, 'correct', 'meaning', 'a'), ans(3, 'correct', 'meaning', 'b'), ans(3, 'correct', 'context', 'c'),
      ans(3, 'wrong', 'listening', 'd'), ans(3, 'unsure', 'listening', 'e'),
      ans(2, 'correct', 'spelling', 'f'), ans(2, 'correct', 'spelling', 'g'),
    ];
    const r = summarize(answers, { goals: ['travel'], minutesPerDay: 20, selfRating: 2 }, NOW);
    expect(r.skills.listening).toEqual({ correct: 0, total: 2 });
    expect(r.skills.reading).toEqual({ correct: 3, total: 3 });
    expect(r.weakSkill).toBe('listening');
  });

  it('applying a result personalises settings and saves known words once', () => {
    const answers: PlacementAnswer[] = [
      { vocabId: 'apple-n', difficulty: 1, kind: 'meaning', result: 'correct' },
      { vocabId: 'decide-v', difficulty: 2, kind: 'meaning', result: 'wrong' },
      { vocabId: 'achieve-v', difficulty: 3, kind: 'context', result: 'unsure' },
    ];
    const r = summarize(answers, { goals: ['travel', 'work'], minutesPerDay: 20, selfRating: 1 }, NOW);
    const d = applyPlacement(defaultData(), r, NOW);
    expect(Object.keys(d.library)).toEqual(['apple-n']);
    expect(d.library['apple-n'].source).toBe('placement');
    expect(d.library['apple-n'].reps).toBe(1);
    expect(d.settings.dailyGoal).toBe(20);
    expect(d.settings.autoLevel).toBe(true);
    expect(d.settings.interests).toEqual(expect.arrayContaining(['travel', 'work', 'business']));
    expect(d.placement?.cefr).toBe(r.cefr);
    // Retaking does not duplicate or reset known words.
    const again = applyPlacement(d, r, NOW + 1000);
    expect(again.library['apple-n'].history).toHaveLength(1);
  });
});
