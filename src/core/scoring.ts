// Deterministic scoring. Points never go negative; misses only reset the combo.

import type { AnswerResult } from './types';

/** Mode weight classes: recognising is easier than producing a word. */
export const WEIGHT = { recognition: 1, listening: 1.2, production: 1.5 } as const;
export type WeightClass = keyof typeof WEIGHT;

export const BASE_POINTS = 10;
export const MAX_COMBO_STEPS = 10;
export const COMPLETION_BONUS_XP = 20;

export function comboMultiplier(combo: number): number {
  return 1 + 0.1 * Math.min(Math.max(0, combo), MAX_COMBO_STEPS);
}

export interface ScoreState {
  points: number;
  combo: number;
  bestCombo: number;
  correct: number;
  graded: number;
}

export const initialScore = (): ScoreState => ({ points: 0, combo: 0, bestCombo: 0, correct: 0, graded: 0 });

export interface ScoreInput {
  result: AnswerResult;
  weight: WeightClass;
  hintUsed?: boolean;
  /** 0..1 fraction of time remaining, timed modes only. */
  timeLeft?: number;
}

/** Points for one answer given the combo *before* it. */
export function pointsFor(input: ScoreInput, comboBefore: number): number {
  if (input.result !== 'correct') return 0;
  let p = BASE_POINTS * WEIGHT[input.weight] * comboMultiplier(comboBefore);
  if (input.hintUsed) p /= 2;
  if (input.timeLeft !== undefined) p += Math.round(5 * Math.min(1, Math.max(0, input.timeLeft)));
  return Math.round(p);
}

export function scoreAnswer(state: ScoreState, input: ScoreInput): { state: ScoreState; gained: number } {
  const gained = pointsFor(input, state.combo);
  const correct = input.result === 'correct';
  const combo = correct ? state.combo + 1 : 0;
  return {
    gained,
    state: {
      points: state.points + gained,
      combo,
      bestCombo: Math.max(state.bestCombo, combo),
      correct: state.correct + (correct ? 1 : 0),
      graded: state.graded + 1,
    },
  };
}

export function sessionXp(points: number, completed: boolean): number {
  return Math.round(points) + (completed ? COMPLETION_BONUS_XP : 0);
}

/** Total XP needed to reach `level` (level 1 needs 0). */
export function xpForLevel(level: number): number {
  return 50 * (level - 1) * level;
}

export function levelForXp(xp: number): { level: number; into: number; span: number } {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const base = xpForLevel(level);
  return { level, into: xp - base, span: xpForLevel(level + 1) - base };
}
