import { applyAnswer, newLibraryItem } from './scheduler';
import { defaultData } from './storage';
import { weakSkill } from './personalize';
import type { Skill } from './types';

const NOW = new Date(2026, 9, 9, 9).getTime();

describe('weakSkill', () => {
  it('falls back to the placement result when there is little practice data', () => {
    const d = { ...defaultData(), placement: { weakSkill: 'writing' as Skill } as never };
    expect(weakSkill(d, NOW)).toBe('writing');
    expect(weakSkill(defaultData(), NOW)).toBeUndefined();
  });

  it('uses recent accuracy by skill once there is enough data', () => {
    let item = newLibraryItem('apple-n', NOW - 1000, 'daily');
    const add = (skill: Skill, result: 'correct' | 'wrong', k: number) => {
      for (let i = 0; i < k; i++) item = applyAnswer(item, { result, now: NOW - 10_000 + i, mode: 'm', skill });
    };
    add('reading', 'correct', 9);
    add('listening', 'wrong', 9);
    add('writing', 'correct', 9);
    const d = { ...defaultData(), library: { 'apple-n': item }, placement: { weakSkill: 'writing' as Skill } as never };
    expect(weakSkill(d, NOW)).toBe('listening');
  });
});
