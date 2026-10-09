import { useState } from 'react';
import { pickDistractors } from '../core/distractors';
import { pick, sample, shuffle } from '../core/rng';
import type { VocabEntry } from '../core/types';
import { Options } from '../ui/components/Options';
import { Instruction, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
  group: string[];
  odd: string;
  oddIsAntonym: boolean;
  order: string[];
}

function OddOneOut({ question, report, done, revealed }: ModeProps<Q>) {
  const { target, odd, group, order } = question;
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <div className="mode odd-one-out">
      <Instruction>Three of these words share a meaning. Which one is the odd one out?</Instruction>
      <Options
        options={order.map((w) => ({ key: w, label: <span lang="en" className="option-word">{w}</span>, ariaLabel: w }))}
        correctKey={odd}
        chosen={chosen}
        revealed={revealed}
        onChoose={(k) => {
          setChosen(k);
          report({ vocabId: target.id, result: k === odd ? 'correct' : 'wrong', given: k === odd ? undefined : k });
          done();
        }}
      />
      {revealed && (
        <p className="explain">
          <strong lang="en">{group.join(', ')}</strong> ≈ {meaningText(target)}.{' '}
          <span lang="en">“{odd}”</span> {question.oddIsAntonym ? `is an opposite of “${target.word}”.` : 'means something different.'}
        </p>
      )}
    </div>
  );
}

export const oddOneOut: ModeDef<Q> = {
  id: 'odd-one-out',
  name: 'Odd One Out',
  icon: '🦄',
  skill: 'reading',
  weight: 'recognition',
  blurb: 'Spot the word that does not belong with the target and its synonyms.',
  targetsPerQuestion: 1,
  isEligible: (e) => (e.synonyms?.length ?? 0) >= 2,
  build: ([target], { all, rng }) => {
    const syns = target.synonyms ?? [];
    if (syns.length < 2) return null;
    const group = [target.word, ...sample(syns, 2, rng)];
    let odd: string | undefined;
    let oddIsAntonym = false;
    if (target.antonyms?.length) {
      odd = pick(target.antonyms, rng);
      oddIsAntonym = true;
    } else {
      const [d] = pickDistractors(target, all, 1, rng, {
        samePos: true,
        filter: (e) => !syns.includes(e.word) && !(e.synonyms ?? []).includes(target.word),
      });
      odd = d?.word;
    }
    if (!odd || group.includes(odd)) return null;
    return { target, group, odd, oddIsAntonym, order: shuffle([...group, odd], rng) };
  },
  Component: OddOneOut,
};
