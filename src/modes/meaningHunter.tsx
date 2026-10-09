import { useState } from 'react';
import { pickDistractors } from '../core/distractors';
import { shuffle } from '../core/rng';
import type { VocabEntry } from '../core/types';
import { Options } from '../ui/components/Options';
import { Instruction, WordHeading, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
  options: { key: string; label: string }[];
}

function MeaningHunter({ question, runtime, report, done, revealed }: ModeProps<Q>) {
  const [chosen, setChosen] = useState<string | null>(null);
  const choose = (key: string) => {
    setChosen(key);
    const ok = key === question.target.id;
    report({
      vocabId: question.target.id,
      result: ok ? 'correct' : 'wrong',
      given: ok ? undefined : question.options.find((o) => o.key === key)?.label,
    });
    done();
  };
  return (
    <div className="mode meaning-hunter">
      <Instruction>Hunt down the Vietnamese meaning.</Instruction>
      <WordHeading entry={question.target} runtime={runtime} />
      <Options options={question.options} correctKey={question.target.id} chosen={chosen} revealed={revealed} onChoose={choose} />
    </div>
  );
}

export const meaningHunter: ModeDef<Q> = {
  id: 'meaning-hunter',
  name: 'Meaning Hunter',
  icon: '🏹',
  skill: 'reading',
  weight: 'recognition',
  blurb: 'See an English word, pick its Vietnamese meaning from four.',
  targetsPerQuestion: 1,
  isEligible: () => true,
  build: ([target], { all, rng }) => {
    const ds = pickDistractors(target, all, 3, rng, { samePos: true });
    if (ds.length < 2) return null;
    return {
      target,
      options: shuffle([target, ...ds], rng).map((e) => ({ key: e.id, label: meaningText(e) })),
    };
  },
  Component: MeaningHunter,
};
