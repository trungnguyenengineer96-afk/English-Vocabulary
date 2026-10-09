// Learning path: five CEFR stages (A1 … C1) built from the word bank.

import { CEFR_INFO, CEFR_ORDER } from './placement';
import type { AppData, Cefr, VocabEntry } from './types';

export const CONQUER_LEARNED = 0.8;
export const CONQUER_MASTERED = 0.4;

export type StageStatus = 'conquered' | 'foundation' | 'current' | 'next' | 'ahead';

export interface Stage {
  cefr: Cefr;
  difficulty: number;
  total: number;
  learned: number;
  mastered: number;
  status: StageStatus;
  /** Words still to learn / master to conquer this stage. */
  toLearn: number;
  toMaster: number;
}

/** Band the learner starts from: placement estimate, else the chosen level. */
export function startBand(d: AppData): number {
  if (d.placement) return Math.min(5, Math.max(1, Math.round(d.placement.theta)));
  return d.settings.level === 'beginner' ? 1 : d.settings.level === 'intermediate' ? 3 : 4;
}

export function buildPath(d: AppData, words: VocabEntry[]): Stage[] {
  const start = startBand(d);
  const stages = CEFR_ORDER.map((cefr, i) => {
    const difficulty = i + 1;
    const band = words.filter((w) => w.difficulty === difficulty);
    const items = band.map((w) => d.library[w.id]).filter(Boolean);
    const learned = items.length;
    const mastered = items.filter((x) => x.state === 'mastered').length;
    const total = band.length;
    return {
      cefr,
      difficulty,
      total,
      learned,
      mastered,
      toLearn: Math.max(0, Math.ceil(total * CONQUER_LEARNED) - learned),
      toMaster: Math.max(0, Math.ceil(total * CONQUER_MASTERED) - mastered),
      status: 'ahead' as StageStatus,
    };
  });
  const conquered = (s: Stage) => s.total > 0 && s.toLearn === 0 && s.toMaster === 0;
  let current = stages.findIndex((s, i) => i + 1 >= start && !conquered(s));
  if (current < 0) current = stages.length - 1;
  stages.forEach((s, i) => {
    if (conquered(s)) s.status = 'conquered';
    else if (i < current) s.status = 'foundation';
    else if (i === current) s.status = 'current';
    else if (i === current + 1) s.status = 'next';
  });
  return stages;
}

export const stageTitle = (c: Cefr) => `${c} · ${CEFR_INFO[c].vi}`;
