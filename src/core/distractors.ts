// Distractor selection. Distractors always come from the real dataset; when not
// enough suitable entries exist, fewer options are returned (callers decide
// whether the question is still buildable).

import { levenshtein } from './text';
import { shuffle, type Rng } from './rng';
import type { VocabEntry } from './types';

const norm = (s: string) => s.trim().toLowerCase();

/** True when two entries could be confused as the same answer. */
export function overlaps(a: VocabEntry, b: VocabEntry): boolean {
  if (a.id === b.id || norm(a.word) === norm(b.word)) return true;
  const am = new Set(a.meaningsVi.map(norm));
  if (b.meaningsVi.some((m) => am.has(norm(m)))) return true;
  const rel = (x: VocabEntry) => new Set([...(x.synonyms ?? []), ...(x.confusables ?? [])].map(norm));
  return rel(a).has(norm(b.word)) || rel(b).has(norm(a.word));
}

export interface DistractorOptions {
  samePos?: boolean;
  /** Prefer words that look similar (for spelling/listening). */
  similarSpelling?: boolean;
  /** Extra predicate candidates must pass. */
  filter?: (e: VocabEntry) => boolean;
  exclude?: Set<string>;
}

export function pickDistractors(
  target: VocabEntry,
  all: VocabEntry[],
  n: number,
  rng: Rng,
  opts: DistractorOptions = {},
): VocabEntry[] {
  const pool = all.filter(
    (e) => !overlaps(target, e) && !opts.exclude?.has(e.id) && (!opts.filter || opts.filter(e)),
  );
  // Never show two options with the same spelling.
  const seenWords = new Set([norm(target.word)]);
  const dedupe = (list: VocabEntry[]) =>
    list.filter((e) => (seenWords.has(norm(e.word)) ? false : (seenWords.add(norm(e.word)), true)));

  let ranked: VocabEntry[];
  if (opts.similarSpelling) {
    const t = norm(target.word);
    ranked = shuffle(pool, rng).sort((a, b) => {
      const da = levenshtein(norm(a.word), t) + Math.abs(a.word.length - t.length) * 0.5;
      const db = levenshtein(norm(b.word), t) + Math.abs(b.word.length - t.length) * 0.5;
      return da - db;
    });
    // Take from the closest third, randomised, so it is not always the same set.
    const head = ranked.slice(0, Math.max(n * 3, 6));
    ranked = [...shuffle(head, rng), ...ranked.slice(head.length)];
  } else {
    ranked = shuffle(pool, rng);
  }
  if (opts.samePos) {
    const same = ranked.filter((e) => e.pos === target.pos);
    const other = ranked.filter((e) => e.pos !== target.pos);
    ranked = [...same, ...other];
  }
  // Avoid two distractors overlapping each other.
  const chosen: VocabEntry[] = [];
  for (const e of dedupe(ranked)) {
    if (chosen.length >= n) break;
    if (chosen.some((c) => overlaps(c, e))) continue;
    chosen.push(e);
  }
  return chosen;
}

/** The meaning shown for an entry in multiple-choice options. */
export const primaryMeaning = (e: VocabEntry) => e.meaningsVi.join(', ');
