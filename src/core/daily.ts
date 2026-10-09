// Daily new-word selection. Seeded per date so a reload yields the same plan.

import { createRng, weightedIndex, type Rng } from './rng';
import type { Difficulty, LearnerLevel, VocabEntry } from './types';

export const DAILY_GOALS = [7, 10, 20, 30] as const;

/** Share of each difficulty (index 0 = A1 … 4 = C1) by learner level. */
export const LEVEL_MIX: Record<LearnerLevel, number[]> = {
  beginner: [0.45, 0.35, 0.15, 0.05, 0],
  intermediate: [0.1, 0.25, 0.35, 0.25, 0.05],
  advanced: [0, 0.1, 0.25, 0.35, 0.3],
};

/**
 * Difficulty mix centred slightly above a measured ability θ (1 = A1 … 5 = C1),
 * so new words are "a little harder than comfortable" (i+1).
 */
export function mixForTheta(theta: number, stretch = 0.4, sd = 0.8): number[] {
  const centre = Math.min(5, Math.max(1, theta + stretch));
  const w = [1, 2, 3, 4, 5].map((d) => Math.exp(-((d - centre) ** 2) / (2 * sd * sd)));
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / total);
}

/** Interest topics are favoured by this factor (the topic cap still applies). */
export const INTEREST_BOOST = 1.8;

export const TOPIC_CAP_SHARE = 0.3;

export type RelaxStep = 'topic-cap' | 'adjacency';

export interface DailyOptions {
  goal: number;
  level: LearnerLevel;
  seed: number;
  /** Ids that must not be picked (already in the library). */
  exclude: Set<string>;
  /** Ids already in today's plan (when topping up after a goal increase). */
  existing?: string[];
  /** Explicit difficulty mix (overrides `level`), e.g. from a placement test. */
  mix?: number[];
  /** Topic tags the learner cares about; matching words are preferred. */
  interests?: string[];
}

export interface DailyResult {
  ids: string[];
  relaxed: RelaxStep[];
}

export function quotas(goal: number, levelOrMix: LearnerLevel | number[]): number[] {
  const mix = Array.isArray(levelOrMix) ? levelOrMix : LEVEL_MIX[levelOrMix];
  const raw = mix.map((m) => m * goal);
  const out = raw.map(Math.floor);
  let left = goal - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, rem: r - Math.floor(r) })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i] += 1;
    left -= 1;
  }
  return out;
}

const norm = (w: string) => w.trim().toLowerCase();
const primaryTopic = (e: VocabEntry) => e.tags[0] ?? '';

function areSynonyms(a: VocabEntry, b: VocabEntry): boolean {
  const as = (a.synonyms ?? []).map(norm);
  const bs = (b.synonyms ?? []).map(norm);
  return as.includes(norm(b.word)) || bs.includes(norm(a.word));
}

interface Ctx {
  dataset: VocabEntry[];
  indexOf: Map<string, number>;
  chosen: VocabEntry[];
  topicCap: number;
  relax: Set<RelaxStep>;
  interests: Set<string>;
}

function allowed(c: VocabEntry, ctx: Ctx): boolean {
  const ci = ctx.indexOf.get(c.id)!;
  let sameTopic = 0;
  for (const s of ctx.chosen) {
    if (s.id === c.id) return false;
    // Never relaxed: two entries with the same spelling on one day.
    if (norm(s.word) === norm(c.word)) return false;
    if (!ctx.relax.has('adjacency')) {
      if (Math.abs(ctx.indexOf.get(s.id)! - ci) <= 1) return false;
      if (areSynonyms(s, c)) return false;
    }
    if (primaryTopic(s) === primaryTopic(c)) sameTopic++;
  }
  if (!ctx.relax.has('topic-cap') && sameTopic >= ctx.topicCap) return false;
  return true;
}

function pickOne(candidates: VocabEntry[], ctx: Ctx, rng: Rng): VocabEntry | undefined {
  const ok = candidates.filter((c) => allowed(c, ctx));
  if (ok.length === 0) return undefined;
  // Prefer common words; rare words still appear.
  const i = weightedIndex(
    ok.map((c) => (0.5 + c.frequency / 5) * (c.tags.some((t) => ctx.interests.has(t)) ? INTEREST_BOOST : 1)),
    rng,
  );
  return ok[i];
}

/** Bands to try for a slot of difficulty `d`: itself, then nearest neighbours. */
function bandOrder(d: number): number[] {
  const out = [d];
  for (let k = 1; k < 5; k++) {
    if (d - k >= 1) out.push(d - k);
    if (d + k <= 5) out.push(d + k);
  }
  return out;
}

export function selectDaily(dataset: VocabEntry[], opts: DailyOptions): DailyResult {
  const rng = createRng(opts.seed);
  const indexOf = new Map(dataset.map((e, i) => [e.id, i]));
  const byId = new Map(dataset.map((e) => [e.id, e]));
  const existing = (opts.existing ?? []).map((id) => byId.get(id)).filter((e): e is VocabEntry => !!e);
  const ctx: Ctx = {
    dataset,
    indexOf,
    chosen: existing.slice(),
    topicCap: Math.max(1, Math.ceil(opts.goal * TOPIC_CAP_SHARE)),
    relax: new Set(),
    interests: new Set(opts.interests ?? []),
  };
  const need = opts.goal - existing.length;
  if (need <= 0) return { ids: existing.map((e) => e.id).slice(0, opts.goal), relaxed: [] };

  const pool = dataset.filter((e) => !opts.exclude.has(e.id) && !existing.some((x) => x.id === e.id));
  const byBand = new Map<number, VocabEntry[]>();
  for (const e of pool) {
    const list = byBand.get(e.difficulty) ?? [];
    list.push(e);
    byBand.set(e.difficulty, list);
  }

  // Slots for the words still needed, distributed by level quotas.
  const q = quotas(opts.goal, opts.mix ?? opts.level);
  for (const e of existing) q[e.difficulty - 1] = Math.max(0, q[e.difficulty - 1] - 1);
  const slots: Difficulty[] = [];
  q.forEach((n, i) => {
    for (let k = 0; k < n; k++) slots.push((i + 1) as Difficulty);
  });
  while (slots.length < need) slots.push(3);
  slots.length = need;

  const relaxOrder: RelaxStep[] = ['topic-cap', 'adjacency'];
  const relaxed: RelaxStep[] = [];
  for (const d of slots) {
    let chosen: VocabEntry | undefined;
    for (let level = 0; level <= relaxOrder.length && !chosen; level++) {
      for (const band of bandOrder(d)) {
        chosen = pickOne(byBand.get(band) ?? [], ctx, rng);
        if (chosen) break;
      }
      if (!chosen && level < relaxOrder.length) {
        const step = relaxOrder[level];
        if (!ctx.relax.has(step)) {
          ctx.relax.add(step);
          relaxed.push(step);
        }
      }
    }
    if (!chosen) break; // pool exhausted
    ctx.chosen.push(chosen);
  }

  const added = ctx.chosen.slice(existing.length);
  return { ids: [...existing, ...spreadTopics(added)].map((e) => e.id), relaxed };
}

/** Reorder so consecutive words avoid sharing a topic where possible. */
export function spreadTopics(entries: VocabEntry[]): VocabEntry[] {
  const rest = entries.slice();
  const out: VocabEntry[] = [];
  while (rest.length) {
    const prev = out[out.length - 1];
    let i = prev ? rest.findIndex((e) => primaryTopic(e) !== primaryTopic(prev)) : 0;
    if (i < 0) i = 0;
    out.push(rest.splice(i, 1)[0]);
  }
  return out;
}
