import { shuffle } from '../core/rng';
import type { VocabEntry } from '../core/types';
import { TileBuilder, type Tile } from '../ui/components/TileBuilder';
import { Instruction, POS_VI, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
  tiles: Tile[];
}

function WordScramble({ question, report, done, revealed }: ModeProps<Q>) {
  const t = question.target;
  return (
    <div className="mode word-scramble">
      <Instruction>Unscramble the letters. Tap tiles or just type.</Instruction>
      <p className="vi-meaning">
        {meaningText(t)} <span className="muted">({POS_VI[t.pos]})</span>
      </p>
      <TileBuilder
        tiles={question.tiles}
        answer={Array.from(t.word)}
        joiner=""
        typeToPick
        revealed={revealed}
        label="Your word"
        onSubmit={(letters) => {
          const given = letters.join('');
          const ok = given.toLowerCase() === t.word.toLowerCase();
          report({ vocabId: t.id, result: ok ? 'correct' : 'wrong', given: ok ? undefined : given });
          done();
        }}
      />
    </div>
  );
}

export const wordScramble: ModeDef<Q> = {
  id: 'word-scramble',
  name: 'Word Scramble',
  icon: '🌀',
  skill: 'writing',
  weight: 'production',
  blurb: 'Rebuild a word from its jumbled letter tiles.',
  targetsPerQuestion: 1,
  isEligible: (e) => /^[a-z]{3,12}$/i.test(e.word) && new Set(e.word).size > 1,
  build: ([target], { rng }) => {
    const letters = Array.from(target.word);
    if (new Set(letters).size < 2) return null;
    let order = shuffle(letters.map((_, i) => i), rng);
    for (let k = 0; k < 10 && order.map((i) => letters[i]).join('') === target.word; k++) order = shuffle(order, rng);
    return { target, tiles: order.map((i) => ({ id: `l${i}`, text: letters[i] })) };
  },
  Component: WordScramble,
};
