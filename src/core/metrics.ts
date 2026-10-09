// Dashboard metrics. Session accuracy and library mastery are distinct concepts
// and are never combined or relabelled.

import { DAY_MS } from './dates';
import { categorize } from './selection';
import type { LearningState, LibraryItem } from './types';

export interface Ratio {
  num: number;
  den: number;
  /** undefined when den is 0 (nothing to measure yet). */
  value: number | undefined;
}

const ratio = (num: number, den: number): Ratio => ({ num, den, value: den > 0 ? num / den : undefined });

/** Session completion: answered questions / total questions. */
export const sessionCompletion = (answered: number, total: number) => ratio(answered, total);
/** Session accuracy: correct answers / graded answers. */
export const sessionAccuracy = (correct: number, graded: number) => ratio(correct, graded);

/** Library mastery: mastered words / total saved words. */
export function libraryMastery(library: Record<string, LibraryItem>): Ratio {
  const items = Object.values(library);
  return ratio(items.filter((i) => i.state === 'mastered').length, items.length);
}

export function stateCounts(library: Record<string, LibraryItem>): Record<LearningState, number> {
  const out = { new: 0, learning: 0, familiar: 0, mastered: 0 };
  for (const i of Object.values(library)) out[i.state] += 1;
  return out;
}

export function dueCount(library: Record<string, LibraryItem>, now: number): number {
  return Object.values(library).filter((i) => i.dueAt <= now).length;
}

/** Words currently needing the most help: recent misses first, then low confidence. */
export function weakWords(library: Record<string, LibraryItem>, now: number, limit = 8): LibraryItem[] {
  return Object.values(library)
    .filter((i) => i.history.length > 0)
    .map((i) => ({ i, c: categorize(i, now) }))
    .filter(({ c }) => c === 'mistakes' || c === 'weak')
    .sort(
      (a, b) =>
        (a.c === 'mistakes' ? 0 : 1) - (b.c === 'mistakes' ? 0 : 1) ||
        a.i.confidence - b.i.confidence ||
        a.i.vocabId.localeCompare(b.i.vocabId),
    )
    .slice(0, limit)
    .map(({ i }) => i);
}

export interface Improvement {
  recent: Ratio;
  previous: Ratio;
  /** Percentage-point change, when both windows have data. */
  delta: number | undefined;
}

/** Answer accuracy in the last `days` vs the `days` before that. */
export function recentImprovement(library: Record<string, LibraryItem>, now: number, days = 7): Improvement {
  let rc = 0, rn = 0, pc = 0, pn = 0;
  const cut1 = now - days * DAY_MS;
  const cut2 = now - 2 * days * DAY_MS;
  for (const item of Object.values(library)) {
    for (const a of item.history) {
      if (a.at > cut1 && a.at <= now) {
        rn++;
        if (a.result === 'correct') rc++;
      } else if (a.at > cut2 && a.at <= cut1) {
        pn++;
        if (a.result === 'correct') pc++;
      }
    }
  }
  const recent = ratio(rc, rn);
  const previous = ratio(pc, pn);
  const delta =
    recent.value !== undefined && previous.value !== undefined
      ? Math.round((recent.value - previous.value) * 100)
      : undefined;
  return { recent, previous, delta };
}

export const formatPct = (r: Ratio) => (r.value === undefined ? '—' : `${Math.round(r.value * 100)}%`);
