// Turns selected target words into a playable session plan. Pure apart from
// importing mode definitions; covered by unit tests.

import { createRng, shuffle, type Rng } from '../core/rng';
import type { SessionSummary, Skill, VocabEntry } from '../core/types';
import { MODES, MODE_BY_ID } from '../modes/registry';
import type { AnyModeDef, BuildContext, ModeId } from '../modes/types';

export interface PlannedQuestion {
  key: string;
  modeId: ModeId;
  targetIds: string[];
  question: unknown;
  round: number;
}

export interface SessionPlan {
  id: string;
  kind: SessionSummary['kind'];
  title: string;
  modeId?: ModeId;
  rounds: { title: string; skill?: Skill }[];
  questions: PlannedQuestion[];
  /** Distinct target words, in play order. */
  targetIds: string[];
  /** Targets that could not be placed in any question (never graded). */
  dropped: string[];
}

export interface PlanContext {
  all: VocabEntry[];
  audioAvailable: boolean;
  seed: number;
}

const bctx = (ctx: PlanContext, rng: Rng): BuildContext => ({ all: ctx.all, rng, audioAvailable: ctx.audioAvailable });

export const eligible = (m: AnyModeDef, e: VocabEntry, ctx: Pick<PlanContext, 'all' | 'audioAvailable'>) =>
  (!m.requiresAudio || ctx.audioAvailable) && m.isEligible(e, ctx);

/** Split n items into chunks of at most `per` and at least `min` (as even as possible). */
export function chunkSizes(n: number, per: number, min = per): number[] {
  if (n <= 0) return [];
  if (per <= 1) return Array(n).fill(1);
  let k = Math.ceil(n / per);
  while (k > 1 && Math.floor(n / k) < min) k--;
  if (n < min) return [];
  const base = Math.floor(n / k);
  const extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}

let counter = 0;
export const newSessionId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Build questions for one mode over `targets`. Unbuildable targets are returned in `dropped`. */
export function buildForMode(
  mode: AnyModeDef,
  targets: VocabEntry[],
  ctx: PlanContext,
  rng: Rng,
  round = 0,
  keyPrefix = 'q',
): { questions: PlannedQuestion[]; dropped: VocabEntry[] } {
  const ok = targets.filter((t) => eligible(mode, t, ctx));
  const dropped = targets.filter((t) => !eligible(mode, t, ctx));
  const questions: PlannedQuestion[] = [];
  if (mode.targetsPerQuestion <= 1) {
    for (const t of ok) {
      const q = mode.build([t], bctx(ctx, rng));
      if (q === null) dropped.push(t);
      else questions.push({ key: `${keyPrefix}${questions.length}`, modeId: mode.id, targetIds: [t.id], question: q, round });
    }
    return { questions, dropped };
  }
  const sizes = chunkSizes(ok.length, mode.targetsPerQuestion, mode.minTargets ?? mode.targetsPerQuestion);
  if (!sizes.length) return { questions, dropped: [...dropped, ...ok] };
  // Multi-target boards can be invalid for a particular grouping (e.g. two words
  // sharing a meaning); reshuffle a few times before giving up on a chunk.
  let best: PlannedQuestion[] = [];
  let bestDropped: VocabEntry[] = ok;
  for (let attempt = 0; attempt < 12 && bestDropped.length; attempt++) {
    const order = attempt === 0 ? ok : shuffle(ok, rng);
    const qs: PlannedQuestion[] = [];
    const dr: VocabEntry[] = [];
    let i = 0;
    for (const size of sizes) {
      const chunk = order.slice(i, i + size);
      i += size;
      const q = mode.build(chunk, bctx(ctx, rng));
      if (q === null) dr.push(...chunk);
      else qs.push({ key: '', modeId: mode.id, targetIds: chunk.map((c) => c.id), question: q, round });
    }
    if (dr.length < bestDropped.length) {
      best = qs;
      bestDropped = dr;
    }
  }
  best.forEach((q, k) => (q.key = `${keyPrefix}${k}`));
  return { questions: best, dropped: [...dropped, ...bestDropped] };
}

export function planSingleMode(modeId: ModeId, targets: VocabEntry[], ctx: PlanContext): SessionPlan {
  const mode = MODE_BY_ID.get(modeId);
  if (!mode) throw new Error(`Unknown mode ${modeId}`);
  const rng = createRng(ctx.seed);
  const { questions, dropped } = buildForMode(mode, targets, ctx, rng);
  return {
    id: newSessionId(),
    kind: 'mode',
    title: mode.name,
    modeId,
    rounds: [{ title: mode.name, skill: mode.skill }],
    questions,
    targetIds: questions.flatMap((q) => q.targetIds),
    dropped: dropped.map((d) => d.id),
  };
}

/** Single-target modes usable for mixing, optionally restricted by skill. */
export function singleTargetModes(skills?: Skill[]): AnyModeDef[] {
  return MODES.filter((m) => m.targetsPerQuestion === 1 && (!skills || skills.includes(m.skill)));
}

/**
 * Adaptive review: one question per word, rotating through modes so the same
 * mechanic is not repeated back-to-back and each word gets a mode its data supports.
 */
export function planReview(
  targets: VocabEntry[],
  ctx: PlanContext,
  opts: { skills?: Skill[]; kind?: SessionSummary['kind']; title?: string } = {},
): SessionPlan {
  const rng = createRng(ctx.seed);
  const pool = singleTargetModes(opts.skills);
  const uses = new Map<ModeId, number>();
  const questions: PlannedQuestion[] = [];
  const dropped: string[] = [];
  let prev: ModeId | undefined;
  for (const t of targets) {
    const sorted = shuffle(
      pool.filter((m) => eligible(m, t, ctx)),
      rng,
    ).sort((a, b) => (uses.get(a.id) ?? 0) - (uses.get(b.id) ?? 0));
    // Least-used first; the previous question's mode only as a last resort.
    const candidates = [...sorted.filter((m) => m.id !== prev), ...sorted.filter((m) => m.id === prev)];
    let placed = false;
    for (const m of candidates) {
      const q = m.build([t], bctx(ctx, rng));
      if (q === null) continue;
      questions.push({ key: `q${questions.length}`, modeId: m.id, targetIds: [t.id], question: q, round: 0 });
      uses.set(m.id, (uses.get(m.id) ?? 0) + 1);
      prev = m.id;
      placed = true;
      break;
    }
    if (!placed) dropped.push(t.id);
  }
  return {
    id: newSessionId(),
    kind: opts.kind ?? 'review',
    title: opts.title ?? 'Adaptive Review',
    rounds: [{ title: opts.title ?? 'Adaptive Review' }],
    questions,
    targetIds: questions.flatMap((q) => q.targetIds),
    dropped,
  };
}
