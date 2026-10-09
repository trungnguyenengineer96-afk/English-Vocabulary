// Achievements reward learning milestones (words saved, mastered, mistakes fixed)
// more than raw scores.

import type { AppData, SessionSummary } from './types';

export interface AchievementDef {
  id: string;
  icon: string;
  name: string;
  description: string;
  check: (d: AppData, last?: SessionSummary) => boolean;
}

const lib = (d: AppData) => Object.values(d.library);
const fixedMistakes = (d: AppData) =>
  lib(d).filter((i) => {
    const h = i.history;
    const lastMiss = h.map((a) => a.result !== 'correct').lastIndexOf(true);
    return lastMiss >= 0 && h.slice(lastMiss + 1).some((a) => a.result === 'correct');
  }).length;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-word', icon: '🌱', name: 'First Step', description: 'Save your first word.', check: (d) => lib(d).length >= 1 },
  { id: 'collector-50', icon: '🎒', name: 'Collector', description: 'Save 50 words to your library.', check: (d) => lib(d).length >= 50 },
  { id: 'collector-150', icon: '🏛️', name: 'Curator', description: 'Save 150 words to your library.', check: (d) => lib(d).length >= 150 },
  { id: 'first-mastered', icon: '⭐', name: 'First Mastery', description: 'Master a word through spaced reviews.', check: (d) => lib(d).some((i) => i.state === 'mastered') },
  { id: 'mastered-25', icon: '🌟', name: 'Word Sage', description: 'Master 25 words.', check: (d) => lib(d).filter((i) => i.state === 'mastered').length >= 25 },
  { id: 'comeback-10', icon: '🔁', name: 'Comeback', description: 'Get 10 previously-missed words right again.', check: (d) => fixedMistakes(d) >= 10 },
  { id: 'perfect-session', icon: '🎯', name: 'Sharp Shooter', description: 'Finish a session of 10+ words with 100% accuracy.',
    check: (_d, s) => !!s && s.graded >= 10 && s.correct === s.graded },
  { id: 'explorer-10', icon: '🧭', name: 'Explorer', description: 'Play 10 different game modes.', check: (d) => Object.keys(d.modeStats).length >= 10 },
  { id: 'explorer-30', icon: '🗺️', name: 'Cartographer', description: 'Play all 30 game modes.', check: (d) => Object.keys(d.modeStats).length >= 30 },
  { id: 'mixed-master', icon: '🎪', name: 'All-Rounder', description: 'Complete a Mixed Challenge.', check: (d) => d.sessions.some((s) => s.kind === 'mixed' && s.answered === s.total && s.total > 0) },
  { id: 'boss-slayer', icon: '🐉', name: 'Boss Slayer', description: 'Defeat a boss in Boss Battle.', check: (d) => (d.achievements['boss-slayer'] ?? 0) > 0 },
  { id: 'steady-7', icon: '📅', name: 'Steady Learner', description: 'Study on 7 different days (they do not need to be in a row).', check: (d) => d.activityDays.length >= 7 },
];

/** Returns ids of newly unlocked achievements. */
export function newlyUnlocked(d: AppData, last?: SessionSummary): string[] {
  return ACHIEVEMENTS.filter((a) => !d.achievements[a.id] && a.check(d, last)).map((a) => a.id);
}
