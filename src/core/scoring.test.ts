import { comboMultiplier, initialScore, levelForXp, pointsFor, scoreAnswer, sessionXp, xpForLevel } from './scoring';

describe('scoring', () => {
  it('base points by weight class', () => {
    expect(pointsFor({ result: 'correct', weight: 'recognition' }, 0)).toBe(10);
    expect(pointsFor({ result: 'correct', weight: 'listening' }, 0)).toBe(12);
    expect(pointsFor({ result: 'correct', weight: 'production' }, 0)).toBe(15);
  });
  it('misses score zero and never negative', () => {
    expect(pointsFor({ result: 'wrong', weight: 'production' }, 5)).toBe(0);
    expect(pointsFor({ result: 'unsure', weight: 'production' }, 5)).toBe(0);
  });
  it('combo multiplier caps at 2x', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(5)).toBe(1.5);
    expect(comboMultiplier(50)).toBe(2);
  });
  it('hint halves, time bonus adds up to 5', () => {
    expect(pointsFor({ result: 'correct', weight: 'recognition', hintUsed: true }, 0)).toBe(5);
    expect(pointsFor({ result: 'correct', weight: 'recognition', timeLeft: 1 }, 0)).toBe(15);
    expect(pointsFor({ result: 'correct', weight: 'recognition', timeLeft: 0.5 }, 0)).toBe(13);
  });
  it('a sequence is deterministic', () => {
    let s = initialScore();
    const seq = ['correct', 'correct', 'wrong', 'correct', 'unsure', 'correct'] as const;
    const gains: number[] = [];
    for (const r of seq) {
      const out = scoreAnswer(s, { result: r, weight: 'recognition' });
      s = out.state;
      gains.push(out.gained);
    }
    expect(gains).toEqual([10, 11, 0, 10, 0, 10]);
    expect(s).toEqual({ points: 41, combo: 1, bestCombo: 2, correct: 4, graded: 6 });
  });
  it('xp and levels', () => {
    expect(sessionXp(41, true)).toBe(61);
    expect(sessionXp(41, false)).toBe(41);
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(levelForXp(0)).toEqual({ level: 1, into: 0, span: 100 });
    expect(levelForXp(250)).toEqual({ level: 2, into: 150, span: 200 });
  });
});
