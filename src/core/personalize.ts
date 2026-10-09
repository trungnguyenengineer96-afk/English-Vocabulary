// Personalisation helpers: which skill a learner should practise more.

import { DAY_MS } from './dates';
import type { AppData, Skill } from './types';

const SKILLS: Skill[] = ['listening', 'writing', 'reading'];
export const WEAK_SKILL_MIN_ATTEMPTS = 8;

/**
 * Weakest of reading / listening / writing: from the last 30 days of answers when
 * there is enough data, otherwise from the placement test.
 */
export function weakSkill(d: AppData, now: number): Skill | undefined {
  const since = now - 30 * DAY_MS;
  const stats = new Map<Skill, { c: number; n: number }>();
  for (const item of Object.values(d.library)) {
    for (const a of item.history) {
      if (a.at < since || a.mode === 'placement' || !SKILLS.includes(a.skill)) continue;
      const s = stats.get(a.skill) ?? { c: 0, n: 0 };
      s.n += 1;
      if (a.result === 'correct') s.c += 1;
      stats.set(a.skill, s);
    }
  }
  const measured = SKILLS.filter((k) => (stats.get(k)?.n ?? 0) >= WEAK_SKILL_MIN_ATTEMPTS);
  if (measured.length >= 2) {
    return measured.reduce((worst, k) => {
      const acc = (x: Skill) => stats.get(x)!.c / stats.get(x)!.n;
      return acc(k) < acc(worst) ? k : worst;
    });
  }
  return d.placement?.weakSkill;
}
