import { createRng } from '../core/rng';
import { WORDS, VOCAB } from '../data/words';
import { MODES } from '../modes/registry';
import { buildForMode, chunkSizes, planReview, planSingleMode } from './planner';

const ctx = { all: WORDS, audioAvailable: true, seed: 11 };
const pick = (n: number, offset = 0) => WORDS.filter((_, i) => i % 3 === 0).slice(offset, offset + n);

describe('chunkSizes', () => {
  it('splits evenly respecting min size', () => {
    expect(chunkSizes(20, 5, 3)).toEqual([5, 5, 5, 5]);
    expect(chunkSizes(7, 5, 3)).toEqual([4, 3]);
    expect(chunkSizes(6, 5, 3)).toEqual([3, 3]);
    expect(chunkSizes(2, 5, 3)).toEqual([]);
    expect(chunkSizes(3, 1)).toEqual([1, 1, 1]);
  });
});

describe('planReview', () => {
  it('gives each distinct word exactly one question and varies modes', () => {
    const targets = pick(20);
    const plan = planReview(targets, ctx);
    expect(plan.targetIds.length).toBe(20);
    expect(new Set(plan.targetIds).size).toBe(20);
    expect(plan.questions.every((q) => q.targetIds.length === 1)).toBe(true);
    for (let i = 1; i < plan.questions.length; i++) {
      expect(plan.questions[i].modeId).not.toBe(plan.questions[i - 1].modeId);
    }
    expect(new Set(plan.questions.map((q) => q.modeId)).size).toBeGreaterThanOrEqual(5);
  });

  it('never uses listening modes when audio is unavailable', () => {
    const plan = planReview(pick(20), { ...ctx, audioAvailable: false });
    const listening = new Set(MODES.filter((m) => m.requiresAudio).map((m) => m.id));
    expect(plan.questions.some((q) => listening.has(q.modeId))).toBe(false);
    expect(plan.targetIds.length).toBe(20);
  });

  it('restricts by skill', () => {
    const plan = planReview(pick(10), ctx, { skills: ['writing'] });
    const writing = new Set(MODES.filter((m) => m.skill === 'writing').map((m) => m.id));
    expect(plan.questions.every((q) => writing.has(q.modeId))).toBe(true);
  });

  it('is deterministic for a seed', () => {
    const a = planReview(pick(10), ctx).questions.map((q) => q.modeId);
    const b = planReview(pick(10), ctx).questions.map((q) => q.modeId);
    expect(a).toEqual(b);
  });
});

describe('planSingleMode', () => {
  it('groups multi-target modes and keeps words distinct', () => {
    const plan = planSingleMode('word-match', pick(20), ctx);
    expect(plan.questions.length).toBeGreaterThanOrEqual(3);
    expect(new Set(plan.targetIds).size).toBe(plan.targetIds.length);
    expect(plan.targetIds.length + plan.dropped.length).toBe(20);
  });

  it('drops words lacking required data instead of inventing it', () => {
    const noExample = { ...VOCAB.get('apple-n')!, id: 'tmp-n', example: undefined };
    const { questions, dropped } = buildForMode(MODES.find((m) => m.id === 'context-master')!, [noExample], ctx, createRng(1));
    expect(questions).toEqual([]);
    expect(dropped.map((d) => d.id)).toEqual(['tmp-n']);
  });
});
