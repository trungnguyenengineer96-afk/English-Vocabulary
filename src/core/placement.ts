// Adaptive placement test: a small IRT model (3PL-style with a fixed guessing
// rate) estimates vocabulary ability θ on the dataset's 1 (A1) … 5 (C1) scale.
// Pure and deterministic; see docs/DESIGN_PROFILES_PLACEMENT_FX.md §2.

import { dayKey } from './dates';
import { addToLibrary } from './library';
import type { Rng } from './rng';
import { weightedIndex } from './rng';
import { applyAnswer } from './scheduler';
import type { AppData, Cefr, DailyGoal, PlacementAnswer, PlacementKind, PlacementResult, Skill, VocabEntry } from './types';

export const GUESS: Record<PlacementKind, number> = { meaning: 0.25, context: 0.25, listening: 0.25, spelling: 0 };
export const DISCRIMINATION = 1.2;
export const MAX_ITEMS = 20;
export const MIN_ITEMS = 12;
export const SE_STOP = 0.3;
export const PRIOR_SD = 1.2;
const GRID = Array.from({ length: 101 }, (_, i) => 0.5 + i * 0.05);

export const KIND_SKILL: Record<PlacementKind, 'reading' | 'listening' | 'writing'> = {
  meaning: 'reading',
  context: 'reading',
  listening: 'listening',
  spelling: 'writing',
};

const logistic = (x: number) => 1 / (1 + Math.exp(-x));
/** Probability the learner "knows" an item of difficulty d (no guessing). */
export const pKnow = (theta: number, d: number) => logistic(1.7 * DISCRIMINATION * (theta - d));
/** Probability of a correct response, including lucky guesses on multiple choice. */
export const pCorrect = (theta: number, d: number, kind: PlacementKind) => GUESS[kind] + (1 - GUESS[kind]) * pKnow(theta, d);

function likelihood(theta: number, a: PlacementAnswer): number {
  if (a.result === 'correct') return pCorrect(theta, a.difficulty, a.kind);
  // "I don't know" is an honest miss: no credit for a possible lucky guess.
  if (a.result === 'unsure') return 1 - pKnow(theta, a.difficulty);
  return 1 - pCorrect(theta, a.difficulty, a.kind);
}

/** Expected-a-posteriori estimate of θ with a normal prior. */
export function estimate(answers: PlacementAnswer[], prior = 2.5): { theta: number; se: number } {
  const post = GRID.map((t) => {
    let l = Math.exp(-((t - prior) ** 2) / (2 * PRIOR_SD * PRIOR_SD));
    for (const a of answers) l *= likelihood(t, a);
    return l;
  });
  const z = post.reduce((s, x) => s + x, 0) || 1;
  const theta = GRID.reduce((s, t, i) => s + t * post[i], 0) / z;
  const variance = GRID.reduce((s, t, i) => s + (t - theta) ** 2 * post[i], 0) / z;
  return { theta: Math.round(theta * 100) / 100, se: Math.round(Math.sqrt(variance) * 100) / 100 };
}

export function shouldStop(answered: number, se: number): boolean {
  return answered >= MAX_ITEMS || (answered >= MIN_ITEMS && se < SE_STOP);
}

/**
 * Question type schedule. Spelling appears early enough (items 8 and 12) to be
 * measured even if the test stops at the minimum length; listening only with audio.
 */
export function kindFor(index: number, theta: number, audio: boolean): PlacementKind {
  if (index === 7 || index === 11) return 'spelling';
  if (audio && index % 4 === 3) return 'listening';
  if (theta >= 2.5 && index % 4 === 1) return 'context';
  return 'meaning';
}

const spellable = (e: VocabEntry) => /^[a-z]{3,10}$/.test(e.word);

export function eligibleFor(kind: PlacementKind, e: VocabEntry): boolean {
  if (kind === 'context') return !!e.example;
  if (kind === 'spelling') return spellable(e);
  return true;
}

/** Choose the next word: unused, at the difficulty nearest the current estimate, common words preferred. */
export function pickItem(
  all: VocabEntry[],
  used: Set<string>,
  theta: number,
  kind: PlacementKind,
  rng: Rng,
): VocabEntry | undefined {
  // Production is harder than recognition, so spelling targets one band lower.
  const target = Math.min(5, Math.max(1, Math.round(theta - (kind === 'spelling' ? 0.7 : 0))));
  const bands = [target, target - 1, target + 1, target - 2, target + 2].filter((d) => d >= 1 && d <= 5);
  for (const d of bands) {
    const pool = all.filter((e) => e.difficulty === d && !used.has(e.id) && eligibleFor(kind, e));
    if (pool.length) return pool[weightedIndex(pool.map((e) => e.frequency), rng)];
  }
  return undefined;
}

export const CEFR_ORDER: Cefr[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
export const CEFR_INFO: Record<Cefr, { vi: string; en: string; level: 'beginner' | 'intermediate' | 'advanced'; icon: string }> = {
  A1: { vi: 'Khởi đầu', en: 'Starter', level: 'beginner', icon: '🌱' },
  A2: { vi: 'Sơ cấp', en: 'Elementary', level: 'beginner', icon: '🌿' },
  B1: { vi: 'Trung cấp', en: 'Intermediate', level: 'intermediate', icon: '🌳' },
  B2: { vi: 'Trung cao cấp', en: 'Upper-intermediate', level: 'intermediate', icon: '🏔️' },
  C1: { vi: 'Nâng cao', en: 'Advanced', level: 'advanced', icon: '🚀' },
};

export function cefrOf(theta: number): Cefr {
  if (theta < 1.5) return 'A1';
  if (theta < 2.5) return 'A2';
  if (theta < 3.5) return 'B1';
  if (theta < 4.5) return 'B2';
  return 'C1';
}

export interface GoalDef {
  id: string;
  icon: string;
  label: string;
  tags: string[];
}

export const GOALS: GoalDef[] = [
  { id: 'daily', icon: '💬', label: 'Giao tiếp hằng ngày', tags: ['daily-life', 'people', 'emotions', 'food', 'home', 'communication', 'shopping', 'time'] },
  { id: 'travel', icon: '✈️', label: 'Du lịch', tags: ['travel', 'places', 'weather', 'culture', 'food', 'nature'] },
  { id: 'work', icon: '💼', label: 'Công việc', tags: ['work', 'business', 'money', 'communication', 'technology'] },
  { id: 'study', icon: '🎓', label: 'Học thuật · Thi cử', tags: ['education', 'science', 'mind', 'society', 'environment', 'cause-effect', 'law'] },
  { id: 'hobby', icon: '🎨', label: 'Sở thích', tags: ['arts', 'sports', 'animals', 'nature', 'culture', 'character'] },
];

export const MINUTES: { minutes: number; goal: DailyGoal; label: string }[] = [
  { minutes: 5, goal: 7, label: '5 phút' },
  { minutes: 10, goal: 10, label: '10 phút' },
  { minutes: 20, goal: 20, label: '20 phút' },
  { minutes: 30, goal: 30, label: '30+ phút' },
];

/** Self-rating → prior ability (only the starting point; answers decide the result). */
export const SELF_RATINGS: { label: string; prior: number }[] = [
  { label: 'Mới bắt đầu', prior: 1.3 },
  { label: 'Biết cơ bản', prior: 2.2 },
  { label: 'Khá', prior: 3.2 },
  { label: 'Tốt', prior: 4.2 },
];

const SKILL_ORDER: ('listening' | 'writing' | 'reading')[] = ['listening', 'writing', 'reading'];

export function summarize(
  answers: PlacementAnswer[],
  survey: { goals: string[]; minutesPerDay: number; selfRating: number },
  now: number,
): PlacementResult {
  const prior = SELF_RATINGS[survey.selfRating]?.prior ?? 2.5;
  const { theta, se } = estimate(answers, prior);
  const skills = { reading: { correct: 0, total: 0 }, listening: { correct: 0, total: 0 }, writing: { correct: 0, total: 0 } };
  for (const a of answers) {
    const s = skills[KIND_SKILL[a.kind]];
    s.total += 1;
    if (a.result === 'correct') s.correct += 1;
  }
  // Weakest skill relative to expectation at this ability (so harder item mixes are fair).
  let weakSkill: Skill | undefined;
  let worst = Infinity;
  for (const k of SKILL_ORDER) {
    const items = answers.filter((a) => KIND_SKILL[a.kind] === k);
    if (items.length < 2) continue;
    const expected = items.reduce((s, a) => s + pCorrect(theta, a.difficulty, a.kind), 0);
    const gap = (skills[k].correct - expected) / items.length;
    if (gap < worst) {
      worst = gap;
      weakSkill = k;
    }
  }
  return { takenAt: now, theta, se, cefr: cefrOf(theta), answers, skills, weakSkill, ...survey };
}

/**
 * Apply a placement result to a learner's data: personalise new-word difficulty,
 * topics and daily goal, and save correctly answered words as "already known"
 * (they still get spaced reviews to confirm).
 */
export function applyPlacement(d: AppData, r: PlacementResult, now: number): AppData {
  const goal = MINUTES.find((m) => m.minutes === r.minutesPerDay)?.goal ?? d.settings.dailyGoal;
  const interests = [...new Set(GOALS.filter((g) => r.goals.includes(g.id)).flatMap((g) => g.tags))];
  let library = d.library;
  for (const a of r.answers) {
    if (a.result !== 'correct') continue;
    const before = library[a.vocabId];
    library = addToLibrary(library, a.vocabId, now, 'placement');
    if (!before) {
      library = {
        ...library,
        [a.vocabId]: applyAnswer(library[a.vocabId], { result: 'correct', now, mode: 'placement', skill: KIND_SKILL[a.kind] }),
      };
    }
  }
  // Re-plan today's new words with the new settings unless learning already started.
  const today = dayKey(now);
  const plans = { ...d.dailyPlans };
  if (plans[today] && plans[today].learnedIds.length === 0) delete plans[today];
  return {
    ...d,
    library,
    dailyPlans: plans,
    placement: r,
    settings: { ...d.settings, dailyGoal: goal, interests, autoLevel: true, level: CEFR_INFO[r.cefr].level },
  };
}
