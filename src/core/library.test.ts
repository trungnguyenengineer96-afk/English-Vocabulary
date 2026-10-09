import { VOCAB } from '../data/words';
import { addToLibrary, fold, queryLibrary, toggleFavorite } from './library';

const NOW = 1_700_000_000_000;

describe('library', () => {
  it('prevents duplicate entries for the same vocabulary item', () => {
    let lib = addToLibrary({}, 'apple-n', NOW, 'daily');
    const first = lib['apple-n'];
    lib = addToLibrary(lib, 'apple-n', NOW + 5, 'manual');
    expect(Object.keys(lib)).toEqual(['apple-n']);
    expect(lib['apple-n']).toBe(first);
  });

  it('search folds Vietnamese diacritics and matches meanings', () => {
    expect(fold('Học Đường')).toBe('hoc duong');
    let lib = addToLibrary({}, 'apple-n', NOW, 'daily');
    lib = addToLibrary(lib, 'school-n', NOW + 1, 'daily');
    expect(queryLibrary(lib, VOCAB, { query: 'truong' }).map((r) => r.entry.id)).toEqual(['school-n']);
    expect(queryLibrary(lib, VOCAB, { query: 'APP' }).map((r) => r.entry.id)).toEqual(['apple-n']);
  });

  it('filters by favorite, state and tag; sorts', () => {
    let lib = addToLibrary({}, 'apple-n', NOW, 'daily');
    lib = addToLibrary(lib, 'school-n', NOW + 1, 'daily');
    lib = toggleFavorite(lib, 'school-n');
    expect(queryLibrary(lib, VOCAB, { favoritesOnly: true }).map((r) => r.entry.id)).toEqual(['school-n']);
    expect(queryLibrary(lib, VOCAB, { tag: 'food' }).map((r) => r.entry.id)).toEqual(['apple-n']);
    expect(queryLibrary(lib, VOCAB, { states: ['mastered'] })).toEqual([]);
    expect(queryLibrary(lib, VOCAB, {}, 'alpha').map((r) => r.entry.id)).toEqual(['apple-n', 'school-n']);
    expect(queryLibrary(lib, VOCAB, {}, 'recent').map((r) => r.entry.id)).toEqual(['school-n', 'apple-n']);
  });
});
