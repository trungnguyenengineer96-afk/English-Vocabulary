import type { VocabEntry } from '../core/types';
import { WORDS_A1 } from './words-a1';
import { WORDS_A2 } from './words-a2';
import { WORDS_B1 } from './words-b1';
import { WORDS_B2 } from './words-b2';
import { WORDS_C1 } from './words-c1';

/**
 * Hand-authored seed dataset. Order matters: the daily selector avoids picking
 * neighbouring entries from this list on the same day.
 */
export const WORDS: VocabEntry[] = [...WORDS_A1, ...WORDS_A2, ...WORDS_B1, ...WORDS_B2, ...WORDS_C1];

export const VOCAB: Map<string, VocabEntry> = new Map(WORDS.map((w) => [w.id, w]));
