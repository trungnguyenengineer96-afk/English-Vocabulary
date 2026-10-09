// Learner profiles. Each profile's progress lives in its own storage document;
// the registry only holds names, avatars and ordering.

import { BACKUP_PREFIX, STORAGE_KEY, type KeyValueStore } from './storage';

export const PROFILES_KEY = 'vocabquest.profiles';
export const profileDataKey = (id: string) => `${STORAGE_KEY}.${id}`;
export const SINGLE_USER_BACKUP = `${BACKUP_PREFIX}single-user`;

export const AVATARS = ['🦉', '🦊', '🐼', '🐯', '🐸', '🐙', '🦄', '🐧', '🐨', '🦁', '🐳', '🐝'];
export const COLORS = ['#5b4ae6', '#e0398c', '#14935a', '#e9741c', '#2f7de1', '#9a4fe0', '#c0392b', '#0f8b8d'];
export const MAX_NAME = 24;

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  color: string;
  createdAt: number;
  lastUsedAt?: number;
}

export interface ProfileRegistry {
  version: 1;
  profiles: Profile[];
  lastProfileId?: string;
}

export const emptyRegistry = (): ProfileRegistry => ({ version: 1, profiles: [] });

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
}

let seq = 0;
export const newProfileId = (now: number) => `p${now.toString(36)}${(seq++).toString(36)}`;

function parseRegistry(text: string | null): ProfileRegistry | undefined {
  if (!text) return undefined;
  try {
    const raw = JSON.parse(text);
    if (!isObj(raw) || !Array.isArray(raw.profiles)) return undefined;
    const profiles: Profile[] = [];
    const seen = new Set<string>();
    for (const p of raw.profiles) {
      if (!isObj(p) || typeof p.id !== 'string' || seen.has(p.id)) continue;
      seen.add(p.id);
      profiles.push({
        id: p.id,
        name: typeof p.name === 'string' && cleanName(p.name) ? cleanName(p.name) : 'Người học',
        avatar: typeof p.avatar === 'string' ? p.avatar : AVATARS[0],
        color: typeof p.color === 'string' ? p.color : COLORS[0],
        createdAt: typeof p.createdAt === 'number' ? p.createdAt : 0,
        ...(typeof p.lastUsedAt === 'number' ? { lastUsedAt: p.lastUsedAt } : {}),
      });
    }
    const last = typeof raw.lastProfileId === 'string' && seen.has(raw.lastProfileId) ? raw.lastProfileId : undefined;
    return { version: 1, profiles, ...(last ? { lastProfileId: last } : {}) };
  } catch {
    return undefined;
  }
}

export function saveRegistry(store: KeyValueStore, reg: ProfileRegistry): void {
  store.setItem(PROFILES_KEY, JSON.stringify(reg));
}

/**
 * Load the registry. On first run after upgrading from the single-user version,
 * the existing progress becomes profile "Người học 1" (a copy of the original is
 * kept as a backup and the original key is left untouched).
 */
export function loadRegistry(store: KeyValueStore, now: number): { registry: ProfileRegistry; migrated: boolean } {
  let text: string | null = null;
  try {
    text = store.getItem(PROFILES_KEY);
  } catch {
    return { registry: emptyRegistry(), migrated: false };
  }
  const reg = parseRegistry(text);
  if (reg) return { registry: reg, migrated: false };

  const legacy = store.getItem(STORAGE_KEY);
  if (!legacy) return { registry: emptyRegistry(), migrated: false };
  const id = newProfileId(now);
  store.setItem(SINGLE_USER_BACKUP, legacy);
  store.setItem(profileDataKey(id), legacy);
  const registry: ProfileRegistry = {
    version: 1,
    profiles: [{ id, name: 'Người học 1', avatar: AVATARS[0], color: COLORS[0], createdAt: now }],
    lastProfileId: id,
  };
  saveRegistry(store, registry);
  return { registry, migrated: true };
}

export function addProfile(reg: ProfileRegistry, p: Omit<Profile, 'id' | 'createdAt'>, now: number): { registry: ProfileRegistry; profile: Profile } {
  const profile: Profile = { id: newProfileId(now), createdAt: now, ...p, name: cleanName(p.name) || `Người học ${reg.profiles.length + 1}` };
  return { registry: { ...reg, profiles: [...reg.profiles, profile] }, profile };
}

export function updateProfile(reg: ProfileRegistry, id: string, patch: Partial<Pick<Profile, 'name' | 'avatar' | 'color'>>): ProfileRegistry {
  return {
    ...reg,
    profiles: reg.profiles.map((p) =>
      p.id === id ? { ...p, ...patch, name: patch.name !== undefined ? cleanName(patch.name) || p.name : p.name } : p,
    ),
  };
}

export function touchProfile(reg: ProfileRegistry, id: string, now: number): ProfileRegistry {
  return { ...reg, lastProfileId: id, profiles: reg.profiles.map((p) => (p.id === id ? { ...p, lastUsedAt: now } : p)) };
}

/** Remove a profile. Its data is copied to a backup key first, never silently lost. */
export function deleteProfile(store: KeyValueStore, reg: ProfileRegistry, id: string, now: number): ProfileRegistry {
  const key = profileDataKey(id);
  const data = store.getItem(key);
  if (data) store.setItem(`${BACKUP_PREFIX}deleted.${id}.${now}`, data);
  if (store.removeItem) store.removeItem(key);
  else store.setItem(key, '');
  const profiles = reg.profiles.filter((p) => p.id !== id);
  return { version: 1, profiles, ...(reg.lastProfileId && reg.lastProfileId !== id ? { lastProfileId: reg.lastProfileId } : {}) };
}

export interface ProfileSummary {
  words: number;
  xp: number;
  cefr?: string;
  mastered: number;
}

/** Light-weight stats for the picker cards (does not migrate or modify data). */
export function profileSummary(store: KeyValueStore, id: string): ProfileSummary {
  try {
    const raw = JSON.parse(store.getItem(profileDataKey(id)) ?? '{}');
    const lib = isObj(raw.library) ? Object.values(raw.library) : [];
    return {
      words: lib.length,
      xp: typeof raw.xp === 'number' ? raw.xp : 0,
      cefr: isObj(raw.placement) && typeof raw.placement.cefr === 'string' ? raw.placement.cefr : undefined,
      mastered: lib.filter((i) => isObj(i) && i.state === 'mastered').length,
    };
  } catch {
    return { words: 0, xp: 0, mastered: 0 };
  }
}
