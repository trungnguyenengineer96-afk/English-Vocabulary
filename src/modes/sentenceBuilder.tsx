import { shuffle } from '../core/rng';
import type { VocabEntry } from '../core/types';
import { TileBuilder, type Tile } from '../ui/components/TileBuilder';
import { Instruction } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
  words: string[];
  ending: string;
  tiles: Tile[];
}

export const MAX_SENTENCE_WORDS = 12;

/** Split a sentence into word tiles and its final punctuation. */
export function sentenceWords(en: string): { words: string[]; ending: string } {
  const m = /^(.*?)([.!?]*)$/.exec(en.trim())!;
  return { words: m[1].split(/\s+/).filter(Boolean), ending: m[2] };
}

function SentenceBuilder({ question, report, done, revealed }: ModeProps<Q>) {
  const { target } = question;
  return (
    <div className="mode sentence-builder">
      <Instruction>Put the words in order to build the English sentence.</Instruction>
      {target.example?.vi && <p className="vi-sentence">🇻🇳 {target.example.vi}</p>}
      <TileBuilder
        tiles={question.tiles}
        answer={question.words}
        revealed={revealed}
        label="Your sentence"
        revealText={target.example?.en}
        onSubmit={(words) => {
          const ok = words.join(' ') === question.words.join(' ');
          report({ vocabId: target.id, result: ok ? 'correct' : 'wrong', given: ok ? undefined : words.join(' ') + question.ending });
          done();
        }}
      />
    </div>
  );
}

export const sentenceBuilder: ModeDef<Q> = {
  id: 'sentence-builder',
  name: 'Sentence Builder',
  icon: '🧱',
  skill: 'writing',
  weight: 'production',
  blurb: 'Arrange word tiles into the example sentence that uses the target word.',
  targetsPerQuestion: 1,
  isEligible: (e) => {
    if (!e.example?.vi) return false;
    const n = sentenceWords(e.example.en).words.length;
    return n >= 4 && n <= MAX_SENTENCE_WORDS;
  },
  build: ([target], { rng }) => {
    if (!target.example?.vi) return null;
    const { words, ending } = sentenceWords(target.example.en);
    if (words.length < 4 || words.length > MAX_SENTENCE_WORDS) return null;
    let order = shuffle(words.map((_, i) => i), rng);
    for (let k = 0; k < 10 && order.every((v, i) => words[v] === words[i]); k++) order = shuffle(order, rng);
    return { target, words, ending, tiles: order.map((i) => ({ id: `w${i}`, text: words[i] })) };
  },
  Component: SentenceBuilder,
};
