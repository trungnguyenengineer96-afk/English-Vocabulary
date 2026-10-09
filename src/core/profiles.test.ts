import { addProfile, deleteProfile, loadRegistry, PROFILES_KEY, profileDataKey, profileSummary, saveRegistry, SINGLE_USER_BACKUP, touchProfile, updateProfile } from './profiles';
import { STORAGE_KEY, type KeyValueStore } from './storage';

class Mem implements KeyValueStore {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
const NOW = 1_760_000_000_000;

describe('profiles', () => {
  it('fresh install has no profiles', () => {
    expect(loadRegistry(new Mem(), NOW)).toEqual({ registry: { version: 1, profiles: [] }, migrated: false });
  });

  it('single-user progress becomes the first profile, with a backup and the original untouched', () => {
    const s = new Mem();
    const legacy = JSON.stringify({ schemaVersion: 2, library: { 'apple-n': { vocabId: 'apple-n' } }, xp: 42 });
    s.setItem(STORAGE_KEY, legacy);
    const { registry, migrated } = loadRegistry(s, NOW);
    expect(migrated).toBe(true);
    expect(registry.profiles).toHaveLength(1);
    const id = registry.profiles[0].id;
    expect(s.getItem(profileDataKey(id))).toBe(legacy);
    expect(s.getItem(SINGLE_USER_BACKUP)).toBe(legacy);
    expect(s.getItem(STORAGE_KEY)).toBe(legacy);
    expect(registry.lastProfileId).toBe(id);
    // Second load reads the registry; no second migration.
    expect(loadRegistry(s, NOW + 1).migrated).toBe(false);
    expect(profileSummary(s, id)).toMatchObject({ words: 1, xp: 42 });
  });

  it('adds, renames, touches and deletes profiles; deleted data is backed up', () => {
    const s = new Mem();
    let { registry } = loadRegistry(s, NOW);
    const a = addProfile(registry, { name: '  Lan   Anh ', avatar: '🦊', color: '#000' }, NOW);
    registry = a.registry;
    expect(a.profile.name).toBe('Lan Anh');
    const b = addProfile(registry, { name: '', avatar: '🐼', color: '#111' }, NOW + 1);
    registry = b.registry;
    expect(b.profile.name).toBe('Người học 2');
    expect(new Set(registry.profiles.map((p) => p.id)).size).toBe(2);
    registry = updateProfile(registry, a.profile.id, { name: 'Lan' });
    registry = touchProfile(registry, a.profile.id, NOW + 5);
    expect(registry.lastProfileId).toBe(a.profile.id);
    s.setItem(profileDataKey(a.profile.id), '{"xp":1}');
    registry = deleteProfile(s, registry, a.profile.id, NOW + 9);
    expect(registry.profiles.map((p) => p.name)).toEqual(['Người học 2']);
    expect(registry.lastProfileId).toBeUndefined();
    expect(s.getItem(profileDataKey(a.profile.id))).toBeNull();
    expect(s.getItem(`vocabquest.backup.deleted.${a.profile.id}.${NOW + 9}`)).toBe('{"xp":1}');
    saveRegistry(s, registry);
    expect(JSON.parse(s.getItem(PROFILES_KEY)!).profiles).toHaveLength(1);
  });

  it('ignores a corrupt registry entry gracefully', () => {
    const s = new Mem();
    s.setItem(PROFILES_KEY, JSON.stringify({ profiles: [{ id: 'x', name: 5 }, 'junk', { id: 'x' }] }));
    const { registry } = loadRegistry(s, NOW);
    expect(registry.profiles).toHaveLength(1);
    expect(registry.profiles[0].name).toBe('Người học');
  });
});
