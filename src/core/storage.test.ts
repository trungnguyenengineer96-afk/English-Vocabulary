import { applyAnswer, newLibraryItem } from './scheduler';
import {
  BACKUP_PREFIX, CURRENT_SCHEMA, STORAGE_KEY, defaultData, exportData, loadData, migrate, parseImport, saveData,
  type KeyValueStore,
} from './storage';

const NOW = 1_750_000_000_000;

class MemStore implements KeyValueStore {
  map = new Map<string, string>();
  failWrites = false;
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.map.set(k, v);
  }
}

describe('storage', () => {
  it('starts fresh with defaults when empty', () => {
    const r = loadData(new MemStore(), NOW);
    expect(r.data).toEqual(defaultData());
    expect(r.readOnly).toBe(false);
  });

  it('round-trips progress across reloads', () => {
    const store = new MemStore();
    const d = defaultData();
    d.library['apple-n'] = applyAnswer(newLibraryItem('apple-n', NOW, 'daily'), {
      result: 'correct', now: NOW, mode: 'meaning-hunter', skill: 'reading',
    });
    d.settings.dailyGoal = 20;
    d.xp = 123;
    d.dailyPlans['2026-01-01'] = { date: '2026-01-01', goal: 20, vocabIds: ['apple-n'], learnedIds: ['apple-n'], relaxed: [] };
    expect(saveData(store, d).ok).toBe(true);
    const r = loadData(store, NOW + 1000);
    expect(r.data).toEqual(d);
  });

  it('keeps a backup of corrupted data and starts fresh', () => {
    const store = new MemStore();
    store.setItem(STORAGE_KEY, '{not json');
    const r = loadData(store, NOW);
    expect(r.data.library).toEqual({});
    expect(store.getItem(`${BACKUP_PREFIX}corrupt.${NOW}`)).toBe('{not json');
    expect(r.notices[0]).toMatch(/unreadable/);
  });

  it('migrates v1 data, backing up the original first', () => {
    const store = new MemStore();
    const v1 = {
      schemaVersion: 1,
      settings: { dailyGoal: 7, level: 'beginner' },
      library: {
        'apple-n': {
          vocabId: 'apple-n', addedAt: NOW, source: 'daily', favorite: true, state: 'learning', confidence: 0.2,
          ease: 2.5, intervalDays: 1, reps: 1, lapses: 0, dueAt: NOW, correctCount: 1, wrongCount: 0,
          history: [{ at: NOW, mode: 'meaning-hunter', skill: 'reading', result: 'correct' }],
        },
      },
      xp: 50,
    };
    const text = JSON.stringify(v1);
    store.setItem(STORAGE_KEY, text);
    const r = loadData(store, NOW);
    expect(store.getItem(`${BACKUP_PREFIX}v1`)).toBe(text);
    expect(r.data.schemaVersion).toBe(CURRENT_SCHEMA);
    expect(r.data.library['apple-n'].unsureCount).toBe(0);
    expect(r.data.library['apple-n'].favorite).toBe(true);
    expect(r.data.library['apple-n'].state).toBe('learning');
    expect(r.data.settings.dailyGoal).toBe(7);
    expect(r.data.settings.showBoss).toBe(true);
    expect(r.data.xp).toBe(50);
    expect(r.notices.join()).toMatch(/upgraded from schema v1/);
  });

  it('runs migration chains in order with injected migrations', () => {
    const calls: number[] = [];
    const m = migrate({ schemaVersion: 1, x: 0 }, {
      current: 3,
      migrations: {
        1: (d) => (calls.push(1), { ...d, x: 1 }),
        2: (d) => (calls.push(2), { ...d, x: (d.x as number) + 1 }),
      },
    });
    expect(calls).toEqual([1, 2]);
    expect(m.data).toEqual({ schemaVersion: 3, x: 2 });
  });

  it('never overwrites data from a newer app version', () => {
    const store = new MemStore();
    store.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: CURRENT_SCHEMA + 1, library: {}, xp: 9 }));
    const r = loadData(store, NOW);
    expect(r.readOnly).toBe(true);
    expect(r.data.xp).toBe(9);
  });

  it('refuses to migrate without a backup', () => {
    const store = new MemStore();
    store.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, library: {} }));
    store.failWrites = true;
    const r = loadData(store, NOW);
    expect(r.readOnly).toBe(true);
  });

  it('repairs malformed items without dropping progress', () => {
    const store = new MemStore();
    store.setItem(STORAGE_KEY, JSON.stringify({
      schemaVersion: CURRENT_SCHEMA,
      library: {
        'apple-n': { reps: 'x', confidence: 7, history: [{ at: NOW, mode: 'm', skill: 'reading', result: 'wrong' }, 3] },
        junk: 5,
      },
      settings: { dailyGoal: 13, testSize: 1000, weights: { mistakes: -5 } },
    }));
    const r = loadData(store, NOW);
    const item = r.data.library['apple-n'];
    expect(item.vocabId).toBe('apple-n');
    expect(item.reps).toBe(0);
    expect(item.confidence).toBe(1);
    expect(item.history.length).toBe(1);
    expect(r.data.library.junk).toBeUndefined();
    expect(r.data.settings.dailyGoal).toBe(10);
    expect(r.data.settings.testSize).toBe(50);
    expect(r.data.settings.weights.mistakes).toBe(0);
  });

  it('merges duplicate records for the same word', () => {
    const store = new MemStore();
    const a = { ...newLibraryItem('apple-n', NOW, 'daily'), favorite: true,
      history: [{ at: NOW, mode: 'm', skill: 'reading', result: 'correct' }] };
    const b = { ...newLibraryItem('apple-n', NOW - 5, 'daily'),
      history: [{ at: NOW - 1, mode: 'm', skill: 'reading', result: 'wrong' }, { at: NOW + 1, mode: 'm', skill: 'reading', result: 'correct' }] };
    store.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: CURRENT_SCHEMA, library: { 'apple-n': a, legacyKey: b } }));
    const r = loadData(store, NOW);
    expect(Object.keys(r.data.library)).toEqual(['apple-n']);
    expect(r.data.library['apple-n'].history.length).toBe(3);
    expect(r.data.library['apple-n'].favorite).toBe(true);
    expect(r.data.library['apple-n'].addedAt).toBe(NOW - 5);
  });

  it('reports save failures instead of throwing', () => {
    const store = new MemStore();
    store.failWrites = true;
    expect(saveData(store, defaultData()).ok).toBe(false);
  });

  it('export/import round-trips and rejects bad files', () => {
    const d = defaultData();
    d.library['apple-n'] = newLibraryItem('apple-n', NOW, 'manual');
    const back = parseImport(exportData(d), NOW);
    expect(back.data?.library['apple-n'].source).toBe('manual');
    expect(parseImport('nope', NOW).error).toBeDefined();
    expect(parseImport('{"a":1}', NOW).error).toBeDefined();
    expect(parseImport(JSON.stringify({ schemaVersion: 99, library: {} }), NOW).error).toMatch(/newer/);
  });
});
