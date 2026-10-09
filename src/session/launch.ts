import { createRng, hashString, shuffle } from '../core/rng';
import { selectForReview } from '../core/selection';
import type { AppData, Skill, VocabEntry } from '../core/types';
import { VOCAB, WORDS } from '../data/words';
import { MODE_BY_ID } from '../modes/registry';
import type { ModeId } from '../modes/types';
import { eligible, planReview, planSingleMode, type SessionPlan } from './planner';

export interface LaunchEnv {
  data: AppData;
  now: number;
  audioAvailable: boolean;
}

const seedOf = (env: LaunchEnv, salt: string) => hashString(`${salt}|${env.now}`);
const entries = (ids: string[]) => ids.map((id) => VOCAB.get(id)).filter((e): e is VocabEntry => !!e);
/** Selection returns words grouped by priority; play them in a seeded random order. */
const playOrder = (env: LaunchEnv, ids: string[]) => entries(shuffle(ids, createRng(seedOf(env, 'order'))));

/** Adaptive review (default 20 distinct words). */
export function reviewPlan(env: LaunchEnv, opts: { size?: number; only?: string[]; skills?: Skill[] } = {}): SessionPlan {
  const sel = selectForReview(env.data.library, {
    size: opts.size ?? env.data.settings.testSize,
    now: env.now,
    weights: env.data.settings.weights,
    seed: seedOf(env, 'review'),
    only: opts.only ? new Set(opts.only) : undefined,
  });
  const ctx = { all: WORDS, audioAvailable: env.audioAvailable, seed: seedOf(env, 'plan') };
  return planReview(playOrder(env, sel.ids), ctx, { skills: opts.skills, title: opts.only ? 'Focused Review' : 'Adaptive Review' });
}

/** Single mode practice, choosing words adaptively among those the mode supports. */
export function modePlan(env: LaunchEnv, modeId: ModeId, opts: { only?: string[] } = {}): SessionPlan {
  const mode = MODE_BY_ID.get(modeId)!;
  const ctx = { all: WORDS, audioAvailable: env.audioAvailable, seed: seedOf(env, modeId) };
  const ok = Object.keys(env.data.library).filter((id) => {
    const e = VOCAB.get(id);
    return e && eligible(mode, e, ctx) && (!opts.only || opts.only.includes(id));
  });
  const sel = selectForReview(env.data.library, {
    size: env.data.settings.testSize,
    now: env.now,
    weights: env.data.settings.weights,
    seed: seedOf(env, `sel-${modeId}`),
    only: new Set(ok),
  });
  return planSingleMode(modeId, playOrder(env, sel.ids), ctx);
}

export function eligibleCount(env: LaunchEnv, modeId: ModeId): number {
  const mode = MODE_BY_ID.get(modeId)!;
  const ctx = { all: WORDS, audioAvailable: env.audioAvailable };
  return Object.keys(env.data.library).filter((id) => {
    const e = VOCAB.get(id);
    return !!e && eligible(mode, e, ctx);
  }).length;
}

/** Quick check right after learning today's words (recognition-focused). */
export function dailyCheckPlan(env: LaunchEnv, ids: string[]): SessionPlan {
  const ctx = { all: WORDS, audioAvailable: env.audioAvailable, seed: seedOf(env, 'daily') };
  return planReview(playOrder(env, ids), ctx, { skills: ['reading', 'arcade'], kind: 'daily-check', title: "Today's Quick Check" });
}
