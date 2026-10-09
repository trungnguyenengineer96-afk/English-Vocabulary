import { WORDS } from './words';
import { containsForm, validateEntries } from './validate';
import manifest from './audio-manifest.json';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { speechKey, TEST_PHRASE } from '../ui/speechKey';

describe('vocabulary dataset', () => {
  it('passes validation', () => {
    expect(validateEntries(WORDS)).toEqual([]);
  });

  it('covers every difficulty band with enough words for a 30-word day', () => {
    for (const d of [1, 2, 3, 4, 5]) {
      expect(WORDS.filter((w) => w.difficulty === d).length).toBeGreaterThanOrEqual(30);
    }
    expect(WORDS.length).toBeGreaterThanOrEqual(240);
  });

  it('has enough metadata for data-dependent modes', () => {
    expect(WORDS.filter((w) => w.emoji).length).toBeGreaterThanOrEqual(8);
    expect(WORDS.filter((w) => w.syllables).length).toBeGreaterThanOrEqual(40);
    expect(WORDS.filter((w) => w.synonyms?.length && w.antonyms?.length).length).toBeGreaterThanOrEqual(20);
    expect(WORDS.filter((w) => w.family?.length).length).toBeGreaterThanOrEqual(40);
    expect(WORDS.filter((w) => w.confusables?.length).length).toBeGreaterThanOrEqual(10);
  });

  it('validator catches malformed entries', () => {
    const errs = validateEntries([
      { id: 'x-n', word: 'cat', pos: 'noun', meaningsVi: [], difficulty: 1, frequency: 1, tags: [] },
      {
        id: 'x-n', word: 'dog', pos: 'noun', meaningsVi: ['chó'], difficulty: 1, frequency: 1, tags: ['a'],
        example: { en: 'A cat.' }, syllables: ['do', 'gg'], stressIndex: 4, collocations: ['hot cat'],
      },
    ]);
    expect(errs.join('\n')).toMatch(/missing Vietnamese meaning/);
    expect(errs.join('\n')).toMatch(/duplicate id/);
    expect(errs.join('\n')).toMatch(/example does not contain/);
    expect(errs.join('\n')).toMatch(/syllables do not spell/);
    expect(errs.join('\n')).toMatch(/stressIndex out of range/);
    expect(errs.join('\n')).toMatch(/collocation/);
  });

  it('containsForm matches whole words only', () => {
    expect(containsForm('I eat bread.', 'eat')).toBe(true);
    expect(containsForm('The weather is great.', 'eat')).toBe(false);
    expect(containsForm('Artificial intelligence', 'artificial')).toBe(true);
  });

  it('has a bundled pronunciation clip for every word, confusable and example sentence', () => {
    const clips = manifest as Record<string, string>;
    const texts = [TEST_PHRASE, ...WORDS.flatMap((w) => [w.word, ...(w.confusables ?? []), ...(w.example ? [w.example.en] : [])])];
    const missing = texts.filter((t) => !clips[speechKey(t)]);
    // Run `npm run audio` after changing the dataset.
    expect(missing).toEqual([]);
    for (const file of new Set(Object.values(clips))) {
      expect(existsSync(path.join(__dirname, '..', '..', 'public', 'audio', file))).toBe(true);
    }
  });
});
