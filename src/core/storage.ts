// Versioned persistence with migrations and backups. User progress is never
// silently discarded: corrupted or older data is copied to a backup key before
// anything is overwritten, and data from a newer app version is never saved over.

import { DEFAULT_WEIGHTS } from './selection';
import { START_EASE, deriveState } from './scheduler';
import type { AppData, LibraryItem, Settings } from './types';

export const STORAGE_KEY = 'vocabquest.state';
export const BACKUP_PREFIX = 'vocabquest.backup.';
export const CURRENT_SCHEMA = 3;
export const SESSION_CAP = 200;

export const DEFAULT_SETTINGS: Settings = {
  dailyGoal: 10,
  level: 'intermediate',
  practiceMode: false,
  reduceMotion: false,
  testSize: 20,
  speechRate: 0.9,
  weights: { ...DEFAULT_WEIGHTS },
  showBoss: true,
  sfx: true,
  sfxVolume: 0.6,
  interests: [],
  autoLevel: false,
};

export function defaultData(): AppData {
  return {
    schemaVersion: CURRENT_SCHEMA,
    settings: { ...DEFAULT_SETTINGS, weights: { ...DEFAULT_WEIGHTS } },
    library: {},
    dailyPlans: {},
    sessions: [],
    xp: 0,
    achievements: {},
    modeStats: {},
    activityDays: [],
  };
}

type Raw = Record<string, unknown>;
export type Migration = (data: Raw) => Raw;

/**
 * Migrations keyed by the version they upgrade *from*.
 * v1 → v2: `lastLapseDay` and `unsureCount` added to library items; settings gained `showBoss`.
 */
export const MIGRATIONS: Record<number, Migration> = {
  1: (d) => {
    const library = (d.library ?? {}) as Record<string, Raw>;
    const next: Record<string, Raw> = {};
    for (const [k, item] of Object.entries(library)) {
      next[k] = { unsureCount: 0, ...item };
    }
    const settings = { showBoss: true, ...((d.settings ?? {}) as Raw) };
    return { ...d, library: next, settings, schemaVersion: 2 };
  },
  // v2 → v3: profiles, placement test and sound-effect settings (all optional, defaults filled on load).
  2: (d) => ({ ...d, schemaVersion: 3 }),
};

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface LoadResult {
  data: AppData;
  /** Human-readable notes about recovery / migration. */
  notices: string[];
  /** When true the stored document must not be overwritten (it is from a newer version). */
  readOnly: boolean;
}

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Repair a library item: fill missing fields with safe defaults, never drop progress. */
export function normalizeItem(key: string, raw: Raw, now: number): LibraryItem {
  const history = Array.isArray(raw.history) ? (raw.history.filter(isObj) as unknown as LibraryItem['history']) : [];
  const item: LibraryItem = {
    vocabId: typeof raw.vocabId === 'string' ? raw.vocabId : key,
    addedAt: num(raw.addedAt, now),
    source: raw.source === 'manual' || raw.source === 'placement' ? raw.source : 'daily',
    favorite: raw.favorite === true,
    state: 'new',
    confidence: Math.min(1, Math.max(0, num(raw.confidence, 0))),
    ease: num(raw.ease, START_EASE),
    intervalDays: Math.max(0, num(raw.intervalDays, 0)),
    reps: Math.max(0, Math.floor(num(raw.reps, 0))),
    lapses: Math.max(0, Math.floor(num(raw.lapses, 0))),
    dueAt: num(raw.dueAt, now),
    correctCount: num(raw.correctCount, 0),
    wrongCount: num(raw.wrongCount, 0),
    unsureCount: num(raw.unsureCount, 0),
    history,
  };
  if (typeof raw.lastReviewedAt === 'number') item.lastReviewedAt = raw.lastReviewedAt;
  if (typeof raw.lastSuccessDay === 'string') item.lastSuccessDay = raw.lastSuccessDay;
  if (typeof raw.lastLapseDay === 'string') item.lastLapseDay = raw.lastLapseDay;
  if (typeof raw.lastMissAt === 'number') item.lastMissAt = raw.lastMissAt;
  if (raw.lastResult === 'correct' || raw.lastResult === 'wrong' || raw.lastResult === 'unsure')
    item.lastResult = raw.lastResult;
  item.state = deriveState(item);
  return item;
}

/** Merge two records for the same word (keeps the richer history and later progress). */
function mergeItems(a: LibraryItem, b: LibraryItem): LibraryItem {
  const [base, other] = a.history.length >= b.history.length ? [a, b] : [b, a];
  const seen = new Set(base.history.map((h) => `${h.at}|${h.mode}|${h.result}`));
  const history = [...base.history, ...other.history.filter((h) => !seen.has(`${h.at}|${h.mode}|${h.result}`))]
    .sort((x, y) => x.at - y.at)
    .slice(-50);
  return { ...base, favorite: a.favorite || b.favorite, addedAt: Math.min(a.addedAt, b.addedAt), history };
}

export function normalizeData(raw: Raw, now: number): AppData {
  const d = defaultData();
  const s = isObj(raw.settings) ? raw.settings : {};
  const goal = s.dailyGoal;
  d.settings = {
    dailyGoal: goal === 7 || goal === 10 || goal === 20 || goal === 30 ? goal : DEFAULT_SETTINGS.dailyGoal,
    level:
      s.level === 'beginner' || s.level === 'intermediate' || s.level === 'advanced' ? s.level : DEFAULT_SETTINGS.level,
    practiceMode: s.practiceMode === true,
    reduceMotion: s.reduceMotion === true,
    testSize: Math.min(50, Math.max(5, Math.floor(num(s.testSize, DEFAULT_SETTINGS.testSize)))),
    speechRate: Math.min(1.5, Math.max(0.5, num(s.speechRate, DEFAULT_SETTINGS.speechRate))),
    weights: isObj(s.weights)
      ? {
          mistakes: Math.max(0, num(s.weights.mistakes, DEFAULT_WEIGHTS.mistakes)),
          due: Math.max(0, num(s.weights.due, DEFAULT_WEIGHTS.due)),
          weak: Math.max(0, num(s.weights.weak, DEFAULT_WEIGHTS.weak)),
          reinforcement: Math.max(0, num(s.weights.reinforcement, DEFAULT_WEIGHTS.reinforcement)),
        }
      : { ...DEFAULT_WEIGHTS },
    showBoss: s.showBoss !== false,
    sfx: s.sfx !== false,
    sfxVolume: Math.min(1, Math.max(0, num(s.sfxVolume, DEFAULT_SETTINGS.sfxVolume))),
    interests: Array.isArray(s.interests) ? [...new Set(s.interests.filter((x): x is string => typeof x === 'string'))] : [],
    autoLevel: s.autoLevel === true,
  };

  const lib = isObj(raw.library) ? raw.library : {};
  for (const [key, value] of Object.entries(lib)) {
    if (!isObj(value)) continue;
    const item = normalizeItem(key, value, now);
    const existing = d.library[item.vocabId];
    d.library[item.vocabId] = existing ? mergeItems(existing, item) : item;
  }

  if (isObj(raw.dailyPlans)) {
    for (const [date, p] of Object.entries(raw.dailyPlans)) {
      if (!isObj(p) || !Array.isArray(p.vocabIds)) continue;
      const ids = [...new Set(p.vocabIds.filter((x): x is string => typeof x === 'string'))];
      const learned = Array.isArray(p.learnedIds) ? p.learnedIds.filter((x): x is string => typeof x === 'string') : [];
      const g = p.goal;
      d.dailyPlans[date] = {
        date,
        goal: g === 7 || g === 10 || g === 20 || g === 30 ? g : d.settings.dailyGoal,
        vocabIds: ids,
        learnedIds: [...new Set(learned)],
        relaxed: Array.isArray(p.relaxed) ? p.relaxed.filter((x): x is string => typeof x === 'string') : [],
      };
    }
  }
  d.sessions = Array.isArray(raw.sessions) ? (raw.sessions.filter(isObj) as unknown as AppData['sessions']).slice(-SESSION_CAP) : [];
  d.xp = Math.max(0, num(raw.xp, 0));
  d.achievements = isObj(raw.achievements)
    ? Object.fromEntries(Object.entries(raw.achievements).filter(([, v]) => typeof v === 'number')) as Record<string, number>
    : {};
  d.modeStats = isObj(raw.modeStats) ? (raw.modeStats as AppData['modeStats']) : {};
  const pl = raw.placement;
  if (isObj(pl) && typeof pl.theta === 'number' && Number.isFinite(pl.theta) && typeof pl.cefr === 'string') {
    d.placement = pl as unknown as AppData['placement'];
  } else if (d.settings.autoLevel) {
    d.settings.autoLevel = false;
  }
  d.activityDays = Array.isArray(raw.activityDays)
    ? [...new Set(raw.activityDays.filter((x): x is string => typeof x === 'string'))].sort()
    : [];
  return d;
}

export interface MigrationOptions {
  current?: number;
  migrations?: Record<number, Migration>;
  /** Storage key of the document (one per learner profile). */
  key?: string;
}

const backupKey = (key: string, suffix: string) =>
  key === STORAGE_KEY ? `${BACKUP_PREFIX}${suffix}` : `${BACKUP_PREFIX}${key}.${suffix}`;

export function migrate(raw: Raw, opts: MigrationOptions = {}): { data: Raw; from: number; to: number } {
  const current = opts.current ?? CURRENT_SCHEMA;
  const migrations = opts.migrations ?? MIGRATIONS;
  const from = num(raw.schemaVersion, 1);
  let data = raw;
  let v = from;
  while (v < current) {
    const step = migrations[v];
    if (!step) throw new Error(`No migration from schema v${v}`);
    data = step(data);
    v += 1;
    data = { ...data, schemaVersion: v };
  }
  return { data, from, to: v };
}

export function loadData(store: KeyValueStore, now: number, opts: MigrationOptions = {}): LoadResult {
  const current = opts.current ?? CURRENT_SCHEMA;
  const docKey = opts.key ?? STORAGE_KEY;
  const notices: string[] = [];
  let text: string | null = null;
  try {
    text = store.getItem(docKey);
  } catch {
    return { data: defaultData(), notices: ['Storage is unavailable; progress will not be saved.'], readOnly: true };
  }
  if (!text) return { data: defaultData(), notices, readOnly: false };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    raw = undefined;
  }
  if (!isObj(raw)) {
    const key = backupKey(docKey, `corrupt.${now}`);
    try {
      store.setItem(key, text);
    } catch {
      return {
        data: defaultData(),
        notices: ['Saved data is unreadable and could not be backed up; it was left untouched.'],
        readOnly: true,
      };
    }
    notices.push(`Saved data was unreadable. A copy was kept under "${key}" and a fresh profile was started.`);
    return { data: defaultData(), notices, readOnly: false };
  }

  const version = num(raw.schemaVersion, 1);
  if (version > current) {
    notices.push(
      `Saved data comes from a newer version (v${version}). It is shown read-only so nothing is overwritten.`,
    );
    return { data: { ...normalizeData(raw, now), schemaVersion: version }, notices, readOnly: true };
  }
  if (version < current) {
    const key = backupKey(docKey, `v${version}`);
    try {
      store.setItem(key, text);
    } catch {
      notices.push('Could not write a pre-migration backup; migration skipped for safety.');
      return { data: normalizeData(raw, now), notices, readOnly: true };
    }
    try {
      const m = migrate(raw, opts);
      raw = m.data;
      notices.push(`Progress upgraded from schema v${m.from} to v${m.to} (backup kept under "${key}").`);
    } catch (e) {
      notices.push(`Migration failed (${(e as Error).message}); original data kept under "${key}".`);
      return { data: normalizeData(raw as Raw, now), notices, readOnly: true };
    }
  }
  const data = normalizeData(raw as Raw, now);
  data.schemaVersion = current;
  return { data, notices, readOnly: false };
}

export function saveData(store: KeyValueStore, data: AppData, key = STORAGE_KEY): { ok: boolean; error?: string } {
  try {
    store.setItem(key, JSON.stringify(data));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function exportData(data: AppData): string {
  return JSON.stringify({ app: 'vocab-quest', exportedAt: new Date().toISOString(), data }, null, 2);
}

/** Parse an export file (or a raw state document), migrating it if needed. */
export function parseImport(text: string, now: number): { data?: AppData; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: 'File is not valid JSON.' };
  }
  const raw = isObj(parsed) && isObj(parsed.data) ? parsed.data : parsed;
  if (!isObj(raw) || !isObj(raw.library)) return { error: 'File does not contain Vocab Quest progress.' };
  const version = num(raw.schemaVersion, 1);
  if (version > CURRENT_SCHEMA) return { error: `File is from a newer app version (v${version}).` };
  try {
    const m = migrate(raw);
    const data = normalizeData(m.data, now);
    data.schemaVersion = CURRENT_SCHEMA;
    return { data };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
