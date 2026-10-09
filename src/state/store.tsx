import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { newlyUnlocked } from '../core/achievements';
import { selectDaily } from '../core/daily';
import { dayKey } from '../core/dates';
import { addToLibrary, toggleFavorite } from '../core/library';
import { hashString } from '../core/rng';
import { applyAnswer, newLibraryItem, type GradeInput } from '../core/scheduler';
import { SESSION_CAP, defaultData, loadData, saveData, type KeyValueStore } from '../core/storage';
import type { AppData, DailyGoal, DailyPlan, SessionSummary, Settings } from '../core/types';
import { WORDS } from '../data/words';

type Action =
  | { type: 'ensurePlan'; now: number }
  | { type: 'learn'; vocabId: string; now: number }
  | { type: 'addManual'; vocabId: string; now: number }
  | { type: 'answer'; vocabId: string; input: GradeInput }
  | { type: 'finishSession'; summary: SessionSummary; now: number }
  | { type: 'settings'; patch: Partial<Settings>; now: number }
  | { type: 'favorite'; vocabId: string }
  | { type: 'unlock'; id: string; now: number }
  | { type: 'replace'; data: AppData };

/** Create or resize today's plan. Learned words are never removed from a plan. */
export function planFor(data: AppData, now: number): DailyPlan {
  const date = dayKey(now);
  const goal = data.settings.dailyGoal;
  const existing = data.dailyPlans[date];
  if (existing && existing.goal === goal && existing.vocabIds.length >= goal) return existing;
  if (existing && existing.vocabIds.length >= goal) {
    // Goal decreased: keep learned words, then the earliest unlearned ones.
    const learned = new Set(existing.learnedIds);
    const keep = existing.vocabIds.filter((id) => learned.has(id));
    for (const id of existing.vocabIds) if (keep.length < goal && !learned.has(id)) keep.push(id);
    const order = existing.vocabIds.filter((id) => keep.includes(id));
    return { ...existing, goal, vocabIds: order };
  }
  const exclude = new Set(Object.keys(data.library));
  for (const id of existing?.vocabIds ?? []) exclude.delete(id);
  const r = selectDaily(WORDS, {
    goal,
    level: data.settings.level,
    seed: hashString(`${date}|${goal}`),
    exclude,
    existing: existing?.vocabIds,
  });
  if (existing && existing.goal === goal && r.ids.length === existing.vocabIds.length) return existing;
  return {
    date,
    goal,
    vocabIds: r.ids,
    learnedIds: existing?.learnedIds ?? [],
    relaxed: [...new Set([...(existing?.relaxed ?? []), ...r.relaxed])],
  };
}

function withActivity(d: AppData, now: number): AppData {
  const k = dayKey(now);
  return d.activityDays.includes(k) ? d : { ...d, activityDays: [...d.activityDays, k].sort() };
}

function unlock(d: AppData, now: number, last?: SessionSummary): AppData {
  const ids = newlyUnlocked(d, last);
  if (!ids.length) return d;
  const achievements = { ...d.achievements };
  for (const id of ids) achievements[id] = now;
  return { ...d, achievements };
}

export function reducer(d: AppData, a: Action): AppData {
  switch (a.type) {
    case 'ensurePlan': {
      const plan = planFor(d, a.now);
      if (d.dailyPlans[plan.date] === plan) return d;
      return { ...d, dailyPlans: { ...d.dailyPlans, [plan.date]: plan } };
    }
    case 'learn': {
      const date = dayKey(a.now);
      const plan = d.dailyPlans[date];
      const library = addToLibrary(d.library, a.vocabId, a.now, 'daily');
      const dailyPlans =
        plan && plan.vocabIds.includes(a.vocabId) && !plan.learnedIds.includes(a.vocabId)
          ? { ...d.dailyPlans, [date]: { ...plan, learnedIds: [...plan.learnedIds, a.vocabId] } }
          : d.dailyPlans;
      return unlock(withActivity({ ...d, library, dailyPlans }, a.now), a.now);
    }
    case 'addManual':
      return unlock({ ...d, library: addToLibrary(d.library, a.vocabId, a.now, 'manual') }, a.now);
    case 'answer': {
      const item = d.library[a.vocabId] ?? newLibraryItem(a.vocabId, a.input.now, 'manual');
      const library = { ...d.library, [a.vocabId]: applyAnswer(item, a.input) };
      const ms = d.modeStats[a.input.mode] ?? { played: 0, correct: 0, graded: 0 };
      const modeStats = {
        ...d.modeStats,
        [a.input.mode]: { ...ms, graded: ms.graded + 1, correct: ms.correct + (a.input.result === 'correct' ? 1 : 0) },
      };
      return withActivity({ ...d, library, modeStats }, a.input.now);
    }
    case 'finishSession': {
      const sessions = [...d.sessions, a.summary].slice(-SESSION_CAP);
      const modeStats = { ...d.modeStats };
      if (a.summary.modeId) {
        const ms = modeStats[a.summary.modeId] ?? { played: 0, correct: 0, graded: 0 };
        modeStats[a.summary.modeId] = { ...ms, played: ms.played + 1 };
      }
      return unlock({ ...d, sessions, xp: d.xp + a.summary.xp, modeStats }, a.now, a.summary);
    }
    case 'settings': {
      const next = { ...d, settings: { ...d.settings, ...a.patch } };
      return a.patch.dailyGoal !== undefined ? reducer(next, { type: 'ensurePlan', now: a.now }) : next;
    }
    case 'favorite':
      return { ...d, library: toggleFavorite(d.library, a.vocabId) };
    case 'unlock':
      return d.achievements[a.id] ? d : { ...d, achievements: { ...d.achievements, [a.id]: a.now } };
    case 'replace':
      return a.data;
  }
}

interface StoreValue {
  data: AppData;
  now: () => number;
  notices: string[];
  readOnly: boolean;
  learn: (vocabId: string) => void;
  addManual: (vocabId: string) => void;
  answer: (vocabId: string, input: Omit<GradeInput, 'now'>) => void;
  finishSession: (summary: SessionSummary) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setDailyGoal: (goal: DailyGoal) => void;
  toggleFav: (vocabId: string) => void;
  unlockAchievement: (id: string) => void;
  replaceData: (data: AppData) => void;
  resetAll: () => void;
  ensurePlan: () => void;
}

const Ctx = createContext<StoreValue | null>(null);

export interface StoreProviderProps {
  children: ReactNode;
  storage?: KeyValueStore;
  clock?: () => number;
}

export function StoreProvider({ children, storage, clock }: StoreProviderProps) {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  const now = useCallback(() => (clock ? clock() : Date.now()), [clock]);
  const initial = useMemo(
    () => (store ? loadData(store, now()) : { data: defaultData(), notices: [], readOnly: true }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [data, dispatch] = useReducer(reducer, initial.data);
  const notices = useRef(initial.notices);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (!initial.notices.length) return; // nothing changed on load
    }
    if (store && !initial.readOnly) {
      const r = saveData(store, data);
      if (!r.ok && !notices.current.includes('save-failed')) {
        notices.current = [...notices.current, `Could not save progress (${r.error}).`];
      }
    }
  }, [data, store, initial.readOnly, initial.notices.length]);

  const value = useMemo<StoreValue>(
    () => ({
      data,
      now,
      notices: notices.current,
      readOnly: initial.readOnly,
      learn: (vocabId) => dispatch({ type: 'learn', vocabId, now: now() }),
      addManual: (vocabId) => dispatch({ type: 'addManual', vocabId, now: now() }),
      answer: (vocabId, input) => dispatch({ type: 'answer', vocabId, input: { ...input, now: now() } }),
      finishSession: (summary) => dispatch({ type: 'finishSession', summary, now: now() }),
      updateSettings: (patch) => dispatch({ type: 'settings', patch, now: now() }),
      setDailyGoal: (goal) => dispatch({ type: 'settings', patch: { dailyGoal: goal }, now: now() }),
      toggleFav: (vocabId) => dispatch({ type: 'favorite', vocabId }),
      unlockAchievement: (id) => dispatch({ type: 'unlock', id, now: now() }),
      replaceData: (d) => dispatch({ type: 'replace', data: d }),
      resetAll: () => dispatch({ type: 'replace', data: defaultData() }),
      ensurePlan: () => dispatch({ type: 'ensurePlan', now: now() }),
    }),
    [data, now, initial.readOnly],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
