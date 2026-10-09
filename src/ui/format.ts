import { DAY_MS, daysBetween, dayKey } from '../core/dates';

export function formatDue(dueAt: number, now: number): string {
  if (dueAt <= now) return 'due now';
  const d = daysBetween(dayKey(now), dayKey(dueAt));
  if (d <= 0) return 'later today';
  if (d === 1) return 'tomorrow';
  if (d < 30) return `in ${d} days`;
  return `in ${Math.round(d / 30)} mo`;
}

export function relativeDay(ts: number, now: number): string {
  const d = Math.round((now - ts) / DAY_MS);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
}
