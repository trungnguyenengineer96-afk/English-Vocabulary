import { dayKey } from '../core/dates';
import { defaultData } from '../core/storage';
import { planFor, reducer } from './store';

const NOW = new Date(2026, 4, 5, 8).getTime();

describe('store reducer', () => {
  it('creates a stable daily plan for the date', () => {
    const d = reducer(defaultData(), { type: 'ensurePlan', now: NOW });
    const plan = d.dailyPlans[dayKey(NOW)];
    expect(plan.vocabIds.length).toBe(10);
    // Idempotent on reload/remount
    expect(reducer(d, { type: 'ensurePlan', now: NOW + 3600_000 })).toBe(d);
  });

  it('learning adds to the library once and records daily progress', () => {
    let d = reducer(defaultData(), { type: 'ensurePlan', now: NOW });
    const id = d.dailyPlans[dayKey(NOW)].vocabIds[0];
    d = reducer(d, { type: 'learn', vocabId: id, now: NOW });
    d = reducer(d, { type: 'learn', vocabId: id, now: NOW + 1 });
    expect(Object.keys(d.library)).toEqual([id]);
    expect(d.dailyPlans[dayKey(NOW)].learnedIds).toEqual([id]);
    expect(d.achievements['first-word']).toBe(NOW);
  });

  it('increasing the goal tops up; decreasing keeps learned words', () => {
    let d = reducer(defaultData(), { type: 'ensurePlan', now: NOW });
    const first = d.dailyPlans[dayKey(NOW)].vocabIds;
    for (const id of first.slice(0, 8)) d = reducer(d, { type: 'learn', vocabId: id, now: NOW });
    d = reducer(d, { type: 'settings', patch: { dailyGoal: 20 }, now: NOW });
    const bigger = d.dailyPlans[dayKey(NOW)];
    expect(bigger.vocabIds.length).toBe(20);
    expect(bigger.vocabIds.slice(0, 10)).toEqual(first);
    d = reducer(d, { type: 'settings', patch: { dailyGoal: 7 }, now: NOW });
    const smaller = d.dailyPlans[dayKey(NOW)];
    expect(smaller.learnedIds.length).toBe(8);
    expect(smaller.learnedIds.every((id) => smaller.vocabIds.includes(id))).toBe(true);
  });

  it('a new day gets new words, excluding saved ones', () => {
    let d = reducer(defaultData(), { type: 'ensurePlan', now: NOW });
    for (const id of d.dailyPlans[dayKey(NOW)].vocabIds) d = reducer(d, { type: 'learn', vocabId: id, now: NOW });
    const tomorrow = NOW + 24 * 3600_000;
    const p2 = planFor(d, tomorrow);
    expect(p2.vocabIds.some((id) => d.library[id])).toBe(false);
  });

  it('answers update the schedule and session finishes add XP once', () => {
    let d = reducer(defaultData(), { type: 'learn', vocabId: 'apple-n', now: NOW });
    d = reducer(d, { type: 'answer', vocabId: 'apple-n', input: { result: 'wrong', now: NOW, mode: 'spell-it', skill: 'writing' } });
    expect(d.library['apple-n'].wrongCount).toBe(1);
    expect(d.modeStats['spell-it']).toEqual({ played: 0, correct: 0, graded: 1 });
    d = reducer(d, {
      type: 'finishSession', now: NOW,
      summary: { id: 's', kind: 'mode', modeId: 'spell-it', startedAt: NOW, finishedAt: NOW, total: 1, answered: 1, correct: 0, graded: 1, xp: 20, points: 0, wrongIds: ['apple-n'] },
    });
    expect(d.xp).toBe(20);
    expect(d.modeStats['spell-it'].played).toBe(1);
  });
});
