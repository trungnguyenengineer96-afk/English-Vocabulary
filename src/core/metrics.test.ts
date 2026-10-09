import { DAY_MS } from './dates';
import { dueCount, libraryMastery, recentImprovement, sessionAccuracy, sessionCompletion, stateCounts, weakWords, formatPct } from './metrics';
import { newLibraryItem } from './scheduler';
import type { LibraryItem } from './types';

const NOW = new Date(2026, 1, 1, 12).getTime();

describe('metrics', () => {
  it('completion, accuracy and mastery are separate ratios', () => {
    expect(sessionCompletion(15, 20).value).toBe(0.75);
    expect(sessionAccuracy(9, 12).value).toBe(0.75);
    expect(sessionAccuracy(0, 0).value).toBeUndefined();
    expect(formatPct(sessionAccuracy(0, 0))).toBe('—');
    const lib: Record<string, LibraryItem> = {
      a: { ...newLibraryItem('a', NOW, 'daily'), state: 'mastered' },
      b: newLibraryItem('b', NOW, 'daily'),
      c: newLibraryItem('c', NOW, 'daily'),
      d: { ...newLibraryItem('d', NOW, 'daily'), state: 'familiar' },
    };
    expect(libraryMastery(lib)).toEqual({ num: 1, den: 4, value: 0.25 });
    expect(stateCounts(lib)).toEqual({ new: 2, learning: 0, familiar: 1, mastered: 1 });
    expect(libraryMastery({}).value).toBeUndefined();
  });

  it('due count and weak words', () => {
    const base = newLibraryItem('x', NOW - 5 * DAY_MS, 'daily');
    const lib: Record<string, LibraryItem> = {
      due: { ...base, vocabId: 'due', dueAt: NOW - 1 },
      later: { ...base, vocabId: 'later', dueAt: NOW + DAY_MS, confidence: 0.9,
        history: [{ at: NOW - DAY_MS, mode: 'm', skill: 'reading', result: 'correct' }], lastResult: 'correct' },
      missed: { ...base, vocabId: 'missed', dueAt: NOW, lastResult: 'wrong', lastMissAt: NOW - 1000,
        history: [{ at: NOW - 1000, mode: 'm', skill: 'reading', result: 'wrong' }] },
    };
    expect(dueCount(lib, NOW)).toBe(2);
    expect(weakWords(lib, NOW).map((i) => i.vocabId)).toEqual(['missed']);
  });

  it('recent improvement compares two windows', () => {
    const h = (daysAgo: number, result: 'correct' | 'wrong') => ({ at: NOW - daysAgo * DAY_MS, mode: 'm', skill: 'reading' as const, result });
    const lib: Record<string, LibraryItem> = {
      a: { ...newLibraryItem('a', NOW, 'daily'), history: [h(10, 'wrong'), h(9, 'correct'), h(2, 'correct'), h(1, 'correct')] },
    };
    const imp = recentImprovement(lib, NOW);
    expect(imp.previous.value).toBe(0.5);
    expect(imp.recent.value).toBe(1);
    expect(imp.delta).toBe(50);
  });
});
