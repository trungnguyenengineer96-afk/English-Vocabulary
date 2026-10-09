// Today's quests: a short, personalised checklist derived from progress data.

import { dayKey } from './dates';
import { dueCount } from './metrics';
import type { AppData, Skill } from './types';

export interface Quest {
  id: 'review' | 'learn' | 'skill' | 'mixed';
  done: boolean;
  optional?: boolean;
  /** Count shown in the label (due words / goal). */
  count?: number;
  skill?: Skill;
}

export function todaysQuests(
  d: AppData,
  now: number,
  weak: Skill | undefined,
  skillOfMode: (modeId: string) => Skill | undefined,
): Quest[] {
  const today = dayKey(now);
  const sessionsToday = d.sessions.filter((s) => dayKey(s.finishedAt) === today);
  const plan = d.dailyPlans[today];
  const learned = plan?.learnedIds.length ?? 0;
  const goal = Math.min(d.settings.dailyGoal, plan?.vocabIds.length ?? d.settings.dailyGoal);
  const due = dueCount(d.library, now);
  const playedWeak = sessionsToday.some(
    (s) => s.kind === 'mixed' || (s.modeId !== undefined && (weak === undefined || skillOfMode(s.modeId) === weak)),
  );
  return [
    { id: 'review', done: due === 0, count: due },
    { id: 'learn', done: goal === 0 || learned >= goal, count: goal },
    { id: 'skill', done: playedWeak, skill: weak },
    { id: 'mixed', done: sessionsToday.some((s) => s.kind === 'mixed'), optional: true },
  ];
}
