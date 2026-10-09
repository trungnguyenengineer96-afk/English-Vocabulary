// Deterministic review-state transitions (spaced repetition).
// See docs/ARCHITECTURE.md §4 for the rules in prose.

import { addDays, dayKey } from './dates';
import type { AnswerResult, Attempt, LearningState, LibraryItem } from './types';

export const HISTORY_CAP = 50;
export const MIN_EASE = 1.3;
export const MAX_EASE = 2.8;
export const START_EASE = 2.5;
export const MASTERED_REPS = 4;
export const MASTERED_CONFIDENCE = 0.8;
export const FAMILIAR_REPS = 2;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Round to 2 decimals so floating noise never changes a state threshold. */
const r2 = (v: number) => Math.round(v * 100) / 100;

export function newLibraryItem(vocabId: string, now: number, source: LibraryItem['source']): LibraryItem {
  return {
    vocabId,
    addedAt: now,
    source,
    favorite: false,
    state: 'new',
    confidence: 0,
    ease: START_EASE,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
    // New words are immediately eligible for a first check.
    dueAt: now,
    correctCount: 0,
    wrongCount: 0,
    unsureCount: 0,
    history: [],
  };
}

export function deriveState(item: Pick<LibraryItem, 'reps' | 'confidence' | 'history'>): LearningState {
  if (item.history.length === 0) return 'new';
  if (item.reps >= MASTERED_REPS && item.confidence >= MASTERED_CONFIDENCE) return 'mastered';
  if (item.reps >= FAMILIAR_REPS) return 'familiar';
  return 'learning';
}

/** Interval (days) after the n-th credited success. */
export function nextInterval(reps: number, prevInterval: number, ease: number): number {
  if (reps <= 1) return 1;
  if (reps === 2) return 3;
  return Math.max(prevInterval + 1, Math.round(prevInterval * ease));
}

export interface GradeInput {
  result: AnswerResult;
  now: number;
  mode: string;
  skill: Attempt['skill'];
  given?: string;
  sessionId?: string;
}

/** Apply one graded answer. Pure: returns a new item. */
export function applyAnswer(item: LibraryItem, input: GradeInput): LibraryItem {
  const { result, now } = input;
  const today = dayKey(now);
  const next: LibraryItem = { ...item, history: item.history.slice() };

  const attempt: Attempt = { at: now, mode: input.mode, skill: input.skill, result };
  if (result === 'wrong' && input.given !== undefined) attempt.given = input.given;
  if (input.sessionId) attempt.sessionId = input.sessionId;
  next.history.push(attempt);
  if (next.history.length > HISTORY_CAP) next.history = next.history.slice(-HISTORY_CAP);
  next.lastReviewedAt = now;
  next.lastResult = result;

  if (result === 'correct') {
    next.correctCount += 1;
    const alreadyCreditedToday = item.lastSuccessDay === today;
    const early = item.reps > 0 && now < item.dueAt;
    if (alreadyCreditedToday || early) {
      next.confidence = r2(clamp(item.confidence + 0.05, 0, 1));
    } else {
      next.reps = item.reps + 1;
      next.intervalDays = nextInterval(next.reps, item.intervalDays, item.ease);
      next.ease = r2(clamp(item.ease + 0.05, MIN_EASE, MAX_EASE));
      next.confidence = r2(clamp(item.confidence + 0.2, 0, 1));
      next.dueAt = addDays(now, next.intervalDays);
      next.lastSuccessDay = today;
    }
  } else {
    const firstLapseToday = item.lastLapseDay !== today;
    if (result === 'wrong') {
      next.wrongCount += 1;
      next.reps = 0;
      next.confidence = r2(clamp(item.confidence - 0.25, 0, 1));
      if (firstLapseToday) {
        next.ease = r2(clamp(item.ease - 0.2, MIN_EASE, MAX_EASE));
        next.lapses = item.lapses + 1;
      }
    } else {
      next.unsureCount += 1;
      next.reps = Math.max(0, item.reps - 2);
      next.confidence = r2(clamp(item.confidence - 0.15, 0, 1));
      if (firstLapseToday) next.ease = r2(clamp(item.ease - 0.1, MIN_EASE, MAX_EASE));
    }
    next.lastLapseDay = today;
    next.intervalDays = 0;
    next.dueAt = now;
    next.lastMissAt = now;
    // A miss also cancels today's credit, so a later correct answer today counts as relearning.
    next.lastSuccessDay = undefined;
  }

  next.state = deriveState(next);
  return next;
}

/** Accuracy over the most recent `n` attempts, or undefined when there are none. */
export function recentAccuracy(item: LibraryItem, n = 5): number | undefined {
  const recent = item.history.slice(-n);
  if (recent.length === 0) return undefined;
  return recent.filter((a) => a.result === 'correct').length / recent.length;
}
