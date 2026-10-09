import { createRng } from '../core/rng';
import { WORDS } from '../data/words';
import { MODE_BY_ID } from '../modes/registry';
import { mixedSkills, planMixed } from './planner';

const targets = WORDS.filter((_, i) => i % 4 === 1).slice(0, 20);
const base = { all: WORDS, audioAvailable: true, seed: 5 };
const skillOf = (id: string) => MODE_BY_ID.get(id as never)!.skill;

describe('Mixed Challenge planner', () => {
  it('uses 20 distinct words in 4 rounds of 5 covering all four skills', () => {
    const plan = planMixed(targets, base, { focus: 'mixed', showBoss: true });
    expect(plan.kind).toBe('mixed');
    expect(plan.rounds).toHaveLength(4);
    expect(new Set(plan.rounds.map((r) => r.skill))).toEqual(new Set(['reading', 'listening', 'writing', 'arcade']));
    expect(plan.targetIds).toHaveLength(20);
    expect(new Set(plan.targetIds).size).toBe(20);
    expect(plan.dropped).toEqual([]);
    for (let r = 0; r < 4; r++) {
      const qs = plan.questions.filter((q) => q.round === r);
      expect(qs.flatMap((q) => q.targetIds)).toHaveLength(5);
      // Every question in a round uses that round's skill (fallbacks are rare and only when data is missing).
      const skill = plan.rounds[r].skill;
      expect(qs.filter((q) => skillOf(q.modeId) === skill).length).toBeGreaterThanOrEqual(qs.length - 1);
    }
  });

  it('arcade round comes last and the plan varies between seeds', () => {
    const sets = new Set<string>();
    for (let seed = 1; seed <= 8; seed++) {
      const plan = planMixed(targets, { ...base, seed }, { focus: 'mixed', showBoss: true });
      expect(plan.rounds[3].skill).toBe('arcade');
      sets.add(plan.questions.map((q) => q.modeId).join(','));
    }
    expect(sets.size).toBeGreaterThan(4);
  });

  it('never schedules listening without audio', () => {
    expect(mixedSkills('mixed', false, createRng(1))).not.toContain('listening');
    const plan = planMixed(targets, { ...base, audioAvailable: false }, { focus: 'mixed', showBoss: true });
    expect(plan.questions.some((q) => skillOf(q.modeId) === 'listening')).toBe(false);
    expect(plan.targetIds).toHaveLength(20);
    expect(() => mixedSkills('listening', false, createRng(1))).toThrow();
  });

  it('focused challenges stay within the chosen skill', () => {
    for (const focus of ['reading', 'writing', 'listening'] as const) {
      const plan = planMixed(targets, base, { focus, showBoss: true });
      const off = plan.questions.filter((q) => skillOf(q.modeId) !== focus);
      expect(off.length).toBeLessThanOrEqual(2);
      expect(plan.targetIds).toHaveLength(20);
    }
  });

  it('respects the boss setting', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const plan = planMixed(targets, { ...base, seed }, { focus: 'mixed', showBoss: false });
      expect(plan.questions.some((q) => q.modeId === 'boss-battle')).toBe(false);
    }
  });

  it('prefers less-played modes for variety', () => {
    const usage = { 'meaning-hunter': 500, 'context-master': 500, 'sentence-detective': 500 } as const;
    const plan = planMixed(targets, base, { focus: 'reading', showBoss: true, usage });
    const heavy = plan.questions.filter((q) => q.modeId in usage).length;
    expect(heavy).toBeLessThanOrEqual(3);
  });

  it('handles small libraries without inventing words', () => {
    const plan = planMixed(targets.slice(0, 6), base, { focus: 'mixed', showBoss: true });
    expect(plan.targetIds).toHaveLength(6);
    expect(plan.rounds.length).toBe(4);
  });
});
