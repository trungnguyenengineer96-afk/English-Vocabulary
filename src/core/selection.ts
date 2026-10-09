// Adaptive review selection: weighted categories with deterministic fallback.

import { DAY_MS } from './dates';
import { recentAccuracy } from './scheduler';
import { createRng, shuffle, type Rng } from './rng';
import type { LibraryItem, ReviewWeights } from './types';

export type ReviewCategory = keyof ReviewWeights;
export const CATEGORY_ORDER: ReviewCategory[] = ['mistakes', 'due', 'weak', 'reinforcement'];

export const DEFAULT_WEIGHTS: ReviewWeights = { mistakes: 40, due: 30, weak: 20, reinforcement: 10 };

/** A miss within this window keeps a word in the "mistakes" bucket until it is re-learned. */
export const MISTAKE_WINDOW_MS = 14 * DAY_MS;

export function categorize(item: LibraryItem, now: number): ReviewCategory {
  const recentMiss = item.lastMissAt !== undefined && now - item.lastMissAt <= MISTAKE_WINDOW_MS;
  if (item.lastResult === 'wrong' || item.lastResult === 'unsure') return 'mistakes';
  if (recentMiss && item.reps < 2) return 'mistakes';
  if (item.dueAt <= now) return 'due';
  const acc = recentAccuracy(item);
  if (item.confidence < 0.5 || (acc !== undefined && item.history.length >= 2 && acc < 0.6)) return 'weak';
  return 'reinforcement';
}

/** Largest-remainder apportionment of `n` slots by weight. Deterministic tie-break by order. */
export function apportion(n: number, weights: ReviewWeights): Record<ReviewCategory, number> {
  const total = CATEGORY_ORDER.reduce((s, c) => s + Math.max(0, weights[c]), 0);
  const out = { mistakes: 0, due: 0, weak: 0, reinforcement: 0 };
  if (n <= 0) return out;
  if (total <= 0) {
    out.reinforcement = n;
    return out;
  }
  const raw = CATEGORY_ORDER.map((c) => (Math.max(0, weights[c]) / total) * n);
  CATEGORY_ORDER.forEach((c, i) => (out[c] = Math.floor(raw[i])));
  let left = n - CATEGORY_ORDER.reduce((s, c) => s + out[c], 0);
  const byRemainder = CATEGORY_ORDER.map((c, i) => ({ c, rem: raw[i] - Math.floor(raw[i]), i })).sort(
    (a, b) => b.rem - a.rem || a.i - b.i,
  );
  for (const { c } of byRemainder) {
    if (left <= 0) break;
    out[c] += 1;
    left -= 1;
  }
  return out;
}

function sortCategory(cat: ReviewCategory, items: LibraryItem[], now: number, rng: Rng): LibraryItem[] {
  switch (cat) {
    case 'mistakes':
      // Most recent miss first; then most misses.
      return items.slice().sort(
        (a, b) =>
          (b.lastMissAt ?? 0) - (a.lastMissAt ?? 0) ||
          b.wrongCount + b.unsureCount - (a.wrongCount + a.unsureCount) ||
          a.vocabId.localeCompare(b.vocabId),
      );
    case 'due': {
      // Most overdue relative to interval first.
      const overdue = (i: LibraryItem) => (now - i.dueAt) / (Math.max(1, i.intervalDays) * DAY_MS);
      return items.slice().sort((a, b) => overdue(b) - overdue(a) || a.vocabId.localeCompare(b.vocabId));
    }
    case 'weak':
      return items.slice().sort((a, b) => a.confidence - b.confidence || a.vocabId.localeCompare(b.vocabId));
    case 'reinforcement':
      return shuffle(
        items.slice().sort((a, b) => a.vocabId.localeCompare(b.vocabId)),
        rng,
      );
  }
}

export interface SelectionOptions {
  size: number;
  now: number;
  weights?: ReviewWeights;
  seed?: number;
  /** Words to exclude (e.g. already used in this session). */
  exclude?: Set<string>;
  /** Restrict to these ids (manual review). */
  only?: Set<string>;
}

export interface SelectionResult {
  ids: string[];
  /** Category each selected id came from. */
  categoryOf: Record<string, ReviewCategory>;
  targets: Record<ReviewCategory, number>;
  taken: Record<ReviewCategory, number>;
  /** True when the library could not supply `size` distinct words. */
  short: boolean;
}

export function selectForReview(library: Record<string, LibraryItem>, opts: SelectionOptions): SelectionResult {
  const { size, now } = opts;
  const weights = opts.weights ?? DEFAULT_WEIGHTS;
  const rng = createRng(opts.seed ?? 1);
  const pools: Record<ReviewCategory, LibraryItem[]> = { mistakes: [], due: [], weak: [], reinforcement: [] };
  for (const item of Object.values(library)) {
    if (opts.exclude?.has(item.vocabId)) continue;
    if (opts.only && !opts.only.has(item.vocabId)) continue;
    pools[categorize(item, now)].push(item);
  }
  const sorted = {} as Record<ReviewCategory, LibraryItem[]>;
  for (const c of CATEGORY_ORDER) sorted[c] = sortCategory(c, pools[c], now, rng);

  const targets = apportion(size, weights);
  const taken = { mistakes: 0, due: 0, weak: 0, reinforcement: 0 };
  const cursor = { mistakes: 0, due: 0, weak: 0, reinforcement: 0 };
  const ids: string[] = [];
  const categoryOf: Record<string, ReviewCategory> = {};

  const takeFrom = (c: ReviewCategory, n: number) => {
    let got = 0;
    while (got < n && cursor[c] < sorted[c].length) {
      const item = sorted[c][cursor[c]++];
      ids.push(item.vocabId);
      categoryOf[item.vocabId] = c;
      taken[c] += 1;
      got += 1;
    }
    return got;
  };

  for (const c of CATEGORY_ORDER) takeFrom(c, targets[c]);
  // Fill any shortfall from other categories, highest priority first.
  let missing = size - ids.length;
  for (const c of CATEGORY_ORDER) {
    if (missing <= 0) break;
    missing -= takeFrom(c, missing);
  }

  return { ids, categoryOf, targets, taken, short: ids.length < size };
}
