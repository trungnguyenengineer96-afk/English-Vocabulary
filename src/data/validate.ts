// Dataset validation. Run by tests so malformed entries never ship.

import type { VocabEntry } from '../core/types';

const POS = new Set(['noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'pronoun', 'phrase']);

/** Whole-word, case-insensitive search for `form` inside `sentence`. */
export function containsForm(sentence: string, form: string): boolean {
  const esc = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z])${esc}($|[^A-Za-z])`, 'i').test(sentence);
}

export function validateEntries(entries: VocabEntry[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const e of entries) {
    const at = `[${e.id}]`;
    if (ids.has(e.id)) errors.push(`${at} duplicate id`);
    ids.add(e.id);
    const key = `${e.word.toLowerCase()}|${e.pos}`;
    if (keys.has(key)) errors.push(`${at} duplicate word+pos`);
    keys.add(key);
    if (!/^[a-z][a-z-]*-(n|v|adj|adv|prep|conj|pron|phr)$/.test(e.id)) errors.push(`${at} bad id format`);
    if (!e.word.trim() || e.word !== e.word.trim()) errors.push(`${at} bad word`);
    if (!POS.has(e.pos)) errors.push(`${at} bad pos`);
    if (!e.meaningsVi.length || e.meaningsVi.some((m) => !m.trim())) errors.push(`${at} missing Vietnamese meaning`);
    if (e.ipa !== undefined && !/^\/[^/]+\/$/.test(e.ipa)) errors.push(`${at} IPA must be wrapped in slashes`);
    if (![1, 2, 3, 4, 5].includes(e.difficulty)) errors.push(`${at} bad difficulty`);
    if (![1, 2, 3, 4, 5].includes(e.frequency)) errors.push(`${at} bad frequency`);
    if (!e.tags.length) errors.push(`${at} needs at least one tag`);
    if (e.example) {
      const form = e.example.form ?? e.word;
      if (!containsForm(e.example.en, form)) errors.push(`${at} example does not contain "${form}"`);
      if (e.example.form && e.example.form.toLowerCase() === e.word.toLowerCase() && e.example.form === e.word)
        errors.push(`${at} redundant example.form`);
    }
    if (e.syllables) {
      if (e.syllables.length < 2) errors.push(`${at} syllables only for 2+ syllable words`);
      if (e.syllables.join('') !== e.word) errors.push(`${at} syllables do not spell the word`);
      if (e.stressIndex === undefined || e.stressIndex < 0 || e.stressIndex >= e.syllables.length)
        errors.push(`${at} stressIndex out of range`);
    } else if (e.stressIndex !== undefined) errors.push(`${at} stressIndex without syllables`);
    if (e.ipa && e.syllables && e.stressIndex !== undefined) {
      // Primary stress mark must exist in multi-syllable IPA.
      if (!e.ipa.includes('ˈ')) errors.push(`${at} IPA lacks primary stress mark`);
    }
    for (const c of e.collocations ?? []) {
      if (!c.toLowerCase().includes(e.word.toLowerCase())) errors.push(`${at} collocation "${c}" lacks the word`);
    }
    const self = e.word.toLowerCase();
    for (const list of [e.synonyms, e.antonyms, e.confusables]) {
      if (list?.some((x) => x.toLowerCase() === self)) errors.push(`${at} lists itself as related word`);
    }
    const syn = new Set((e.synonyms ?? []).map((s) => s.toLowerCase()));
    if ((e.antonyms ?? []).some((a) => syn.has(a.toLowerCase()))) errors.push(`${at} word is both synonym and antonym`);
    if (e.family?.some((f) => f.word.toLowerCase() === self && f.pos === e.pos)) errors.push(`${at} family lists itself`);
  }
  return errors;
}
