import { useState } from 'react';
import { pickDistractors } from '../core/distractors';
import { shuffle } from '../core/rng';
import type { VocabEntry } from '../core/types';
import { Options } from '../ui/components/Options';
import { Instruction, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
  direction: 'picture-to-word' | 'word-to-picture';
  options: VocabEntry[];
}

function PictureQuest({ question, report, done, revealed }: ModeProps<Q>) {
  const { target, direction, options } = question;
  const [chosen, setChosen] = useState<string | null>(null);
  const toWord = direction === 'picture-to-word';
  return (
    <div className="mode picture-quest">
      <Instruction>{toWord ? 'Which word matches the picture?' : 'Which picture shows this word?'}</Instruction>
      {toWord ? (
        <div className="picture" role="img" aria-label="Picture clue (emoji)">{target.emoji}</div>
      ) : (
        <p className="big-word center" lang="en">{target.word}</p>
      )}
      <Options
        className={toWord ? '' : 'emoji-options'}
        options={options.map((e) =>
          toWord
            ? { key: e.id, label: <span lang="en" className="option-word">{e.word}</span>, ariaLabel: e.word }
            : { key: e.id, label: <span className="emoji-option" aria-hidden="true">{e.emoji}</span>, ariaLabel: `Picture ${options.indexOf(e) + 1}` },
        )}
        correctKey={target.id}
        chosen={chosen}
        revealed={revealed}
        onChoose={(k) => {
          setChosen(k);
          const ok = k === target.id;
          const pickedEntry = options.find((o) => o.id === k);
          report({ vocabId: target.id, result: ok ? 'correct' : 'wrong', given: ok ? undefined : toWord ? pickedEntry?.word : `${pickedEntry?.emoji} (${pickedEntry?.word})` });
          done();
        }}
      />
      {revealed && (
        <p className="explain">
          {target.emoji} <strong lang="en">{target.word}</strong> — {meaningText(target)}
        </p>
      )}
    </div>
  );
}

export const pictureQuest: ModeDef<Q> = {
  id: 'picture-quest',
  name: 'Picture Quest',
  icon: '🖼️',
  skill: 'arcade',
  weight: 'recognition',
  blurb: 'Match pictures and words — only for words that have a clear picture.',
  targetsPerQuestion: 1,
  isEligible: (e) => !!e.emoji,
  build: ([target], { all, rng }) => {
    if (!target.emoji) return null;
    const ds = pickDistractors(target, all, 3, rng, { filter: (e) => !!e.emoji && e.emoji !== target.emoji });
    if (ds.length < 3) return null;
    return {
      target,
      direction: rng() < 0.5 ? 'picture-to-word' : 'word-to-picture',
      options: shuffle([target, ...ds], rng),
    };
  },
  Component: PictureQuest,
};
