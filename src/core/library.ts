// Library operations. The library is keyed by vocabId, which makes duplicate
// entries for the same vocabulary item impossible by construction.

import { newLibraryItem } from './scheduler';
import type { LearningState, LibraryItem, VocabEntry } from './types';

export function addToLibrary(
  library: Record<string, LibraryItem>,
  vocabId: string,
  now: number,
  source: LibraryItem['source'],
): Record<string, LibraryItem> {
  if (library[vocabId]) return library;
  return { ...library, [vocabId]: newLibraryItem(vocabId, now, source) };
}

export function toggleFavorite(library: Record<string, LibraryItem>, vocabId: string): Record<string, LibraryItem> {
  const item = library[vocabId];
  if (!item) return library;
  return { ...library, [vocabId]: { ...item, favorite: !item.favorite } };
}

/** Lowercase, strip Vietnamese diacritics so "hoc" matches "học". */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

export interface LibraryFilter {
  query?: string;
  states?: LearningState[];
  favoritesOnly?: boolean;
  tag?: string;
  dueOnly?: boolean;
  now?: number;
}

export type LibrarySort = 'recent' | 'alpha' | 'due' | 'weakest';

export interface LibraryRow {
  item: LibraryItem;
  entry: VocabEntry;
}

export function queryLibrary(
  library: Record<string, LibraryItem>,
  vocab: Map<string, VocabEntry>,
  filter: LibraryFilter,
  sort: LibrarySort = 'recent',
): LibraryRow[] {
  const q = filter.query ? fold(filter.query.trim()) : '';
  const rows: LibraryRow[] = [];
  for (const item of Object.values(library)) {
    const entry = vocab.get(item.vocabId);
    if (!entry) continue;
    if (filter.states?.length && !filter.states.includes(item.state)) continue;
    if (filter.favoritesOnly && !item.favorite) continue;
    if (filter.tag && !entry.tags.includes(filter.tag)) continue;
    if (filter.dueOnly && item.dueAt > (filter.now ?? Date.now())) continue;
    if (q) {
      const hay = [entry.word, ...entry.meaningsVi, ...(entry.synonyms ?? [])].map(fold);
      if (!hay.some((h) => h.includes(q))) continue;
    }
    rows.push({ item, entry });
  }
  const cmp: Record<LibrarySort, (a: LibraryRow, b: LibraryRow) => number> = {
    recent: (a, b) => b.item.addedAt - a.item.addedAt || a.entry.word.localeCompare(b.entry.word),
    alpha: (a, b) => a.entry.word.localeCompare(b.entry.word),
    due: (a, b) => a.item.dueAt - b.item.dueAt || a.entry.word.localeCompare(b.entry.word),
    weakest: (a, b) => a.item.confidence - b.item.confidence || a.entry.word.localeCompare(b.entry.word),
  };
  return rows.sort(cmp[sort]);
}
