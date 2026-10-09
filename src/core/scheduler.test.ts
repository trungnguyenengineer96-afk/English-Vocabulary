import { addDays, DAY_MS } from './dates';
import { applyAnswer, deriveState, newLibraryItem, nextInterval, HISTORY_CAP, MIN_EASE } from './scheduler';
import type { AnswerResult, LibraryItem } from './types';

// 2026-03-02 09:00 local (Asia/Ho_Chi_Minh set by vitest config)
const T0 = new Date(2026, 2, 2, 9, 0, 0).getTime();
const grade = (item: LibraryItem, result: AnswerResult, now: number) =>
  applyAnswer(item, { result, now, mode: 'meaning-hunter', skill: 'reading' });

describe('scheduler', () => {
  it('new items start as New, due immediately', () => {
    const i = newLibraryItem('apple-n', T0, 'daily');
    expect(i.state).toBe('new');
    expect(i.dueAt).toBe(T0);
    expect(deriveState(i)).toBe('new');
  });

  it('interval sequence is 1, 3, then prev*ease', () => {
    expect(nextInterval(1, 0, 2.5)).toBe(1);
    expect(nextInterval(2, 1, 2.5)).toBe(3);
    expect(nextInterval(3, 3, 2.5)).toBe(8);
    expect(nextInterval(4, 8, 2.6)).toBe(21);
    // never shrinks
    expect(nextInterval(3, 3, 1.3)).toBe(4);
  });

  it('first correct answer → Learning, due tomorrow at local midnight', () => {
    const i = grade(newLibraryItem('a', T0, 'daily'), 'correct', T0);
    expect(i.state).toBe('learning');
    expect(i.reps).toBe(1);
    expect(i.intervalDays).toBe(1);
    expect(i.dueAt).toBe(addDays(T0, 1));
    expect(new Date(i.dueAt).getHours()).toBe(0);
    expect(i.confidence).toBe(0.2);
  });

  it('a second correct answer the same day does not grow the interval', () => {
    let i = grade(newLibraryItem('a', T0, 'daily'), 'correct', T0);
    const before = { ...i };
    i = grade(i, 'correct', T0 + 60_000);
    expect(i.reps).toBe(before.reps);
    expect(i.intervalDays).toBe(before.intervalDays);
    expect(i.dueAt).toBe(before.dueAt);
    expect(i.confidence).toBe(0.25);
    expect(i.correctCount).toBe(2);
  });

  it('a correct answer before the word is due does not grow the interval', () => {
    let i = grade(newLibraryItem('a', T0, 'daily'), 'correct', T0); // due tomorrow
    i = grade(i, 'correct', addDays(T0, 1)); // reps 2, due in 3 days
    const early = addDays(T0, 2) + 10 * 3600_000;
    const j = grade(i, 'correct', early);
    expect(j.reps).toBe(2);
    expect(j.dueAt).toBe(i.dueAt);
  });

  it('correct answers alone never make a word Mastered in one session', () => {
    let i = newLibraryItem('a', T0, 'daily');
    for (let k = 0; k < 20; k++) i = grade(i, 'correct', T0 + k * 1000);
    expect(i.state).not.toBe('mastered');
    expect(i.reps).toBe(1);
  });

  it('spaced successes on separate due days lead to Familiar then Mastered', () => {
    let i = newLibraryItem('a', T0, 'daily');
    const states: string[] = [];
    let now = T0;
    let masteredAt = 0;
    for (let k = 0; k < 5; k++) {
      i = grade(i, 'correct', now);
      states.push(i.state);
      if (i.state === 'mastered' && !masteredAt) masteredAt = now;
      now = i.dueAt + 9 * 3600_000; // review at 9am on the due day
    }
    expect(states).toEqual(['learning', 'familiar', 'familiar', 'mastered', 'mastered']);
    // Mastery needs the 4th spaced success: days 0, 1, 4, 12.
    expect(Math.round((masteredAt - T0) / DAY_MS)).toBe(12);
    expect(i.reps).toBeGreaterThanOrEqual(4);
  });

  it('a wrong answer resets reps, drops to Learning, due now, marks a miss', () => {
    let i = newLibraryItem('a', T0, 'daily');
    let now = T0;
    for (let k = 0; k < 6; k++) {
      i = grade(i, 'correct', now);
      now = i.dueAt + 3600_000;
    }
    expect(i.state).toBe('mastered');
    const w = applyAnswer(i, { result: 'wrong', now, mode: 'spell-it', skill: 'writing', given: 'aple' });
    expect(w.state).toBe('learning');
    expect(w.reps).toBe(0);
    expect(w.dueAt).toBe(now);
    expect(w.lastMissAt).toBe(now);
    expect(w.lapses).toBe(1);
    expect(w.ease).toBe(Math.round((i.ease - 0.2) * 100) / 100);
    expect(w.history.at(-1)).toMatchObject({ result: 'wrong', given: 'aple', mode: 'spell-it' });
  });

  it('repeated misses on one day count one lapse and one ease penalty', () => {
    let i = grade(newLibraryItem('a', T0, 'daily'), 'wrong', T0);
    i = grade(i, 'wrong', T0 + 1000);
    i = grade(i, 'wrong', T0 + 2000);
    expect(i.lapses).toBe(1);
    expect(i.ease).toBe(2.3);
    expect(i.wrongCount).toBe(3);
    expect(i.confidence).toBe(0);
  });

  it('"I don\'t know" (unsure) reduces reps by 2 and marks a miss', () => {
    let i = newLibraryItem('a', T0, 'daily');
    let now = T0;
    for (let k = 0; k < 3; k++) {
      i = grade(i, 'correct', now);
      now = i.dueAt + 3600_000;
    }
    expect(i.reps).toBe(3);
    const u = grade(i, 'unsure', now);
    expect(u.reps).toBe(1);
    expect(u.state).toBe('learning');
    expect(u.unsureCount).toBe(1);
    expect(u.lastMissAt).toBe(now);
    expect(u.dueAt).toBe(now);
  });

  it('relearning after a miss on the same day is credited', () => {
    let i = grade(newLibraryItem('a', T0, 'daily'), 'correct', T0);
    i = grade(i, 'wrong', T0 + 1000);
    i = grade(i, 'correct', T0 + 2000);
    expect(i.reps).toBe(1);
    expect(i.intervalDays).toBe(1);
  });

  it('ease never drops below the minimum', () => {
    let i = newLibraryItem('a', T0, 'daily');
    for (let d = 0; d < 20; d++) i = grade(i, 'wrong', addDays(T0, d));
    expect(i.ease).toBe(MIN_EASE);
  });

  it('history is capped', () => {
    let i = newLibraryItem('a', T0, 'daily');
    for (let k = 0; k < HISTORY_CAP + 10; k++) i = grade(i, 'correct', T0 + k);
    expect(i.history.length).toBe(HISTORY_CAP);
  });

  it('does not mutate its input', () => {
    const i = newLibraryItem('a', T0, 'daily');
    const copy = JSON.parse(JSON.stringify(i));
    grade(i, 'wrong', T0);
    expect(i).toEqual(copy);
  });
});
