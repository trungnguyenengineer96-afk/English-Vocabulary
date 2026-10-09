import { useState } from 'react';
import { pickDistractors } from '../core/distractors';
import { shuffle } from '../core/rng';
import { blankOut } from '../core/text';
import type { VocabEntry } from '../core/types';
import { Options } from '../ui/components/Options';
import { Instruction, exampleForm } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
  sentence: string;
  translation?: string;
  baseFormNote: boolean;
  options: { key: string; label: string }[];
}

function ContextMaster({ question, report, done, revealed }: ModeProps<Q>) {
  const [chosen, setChosen] = useState<string | null>(null);
  const choose = (key: string) => {
    setChosen(key);
    const ok = key === question.target.id;
    report({ vocabId: question.target.id, result: ok ? 'correct' : 'wrong', given: question.options.find((o) => o.key === key)?.label });
    done();
  };
  const [before, after] = question.sentence.split('_____');
  return (
    <div className="mode context-master">
      <Instruction>
        Complete the sentence.{question.baseFormNote ? ' Options are shown in their base form.' : ''}
      </Instruction>
      <p className="sentence" lang="en">
        {before}
        <span className={`blank ${revealed ? 'filled' : ''}`}>
          {revealed ? question.target.example?.form ?? question.target.word : ' '.repeat(8)}
        </span>
        {after}
      </p>
      {revealed && question.translation && <p className="translation">{question.translation}</p>}
      <Options options={question.options} correctKey={question.target.id} chosen={chosen} revealed={revealed} onChoose={choose} />
    </div>
  );
}

export const contextMaster: ModeDef<Q> = {
  id: 'context-master',
  name: 'Context Master',
  icon: '🧩',
  skill: 'reading',
  weight: 'recognition',
  blurb: 'Choose the word that completes a real example sentence.',
  targetsPerQuestion: 1,
  isEligible: (e) => !!e.example,
  build: ([target], { all, rng }) => {
    if (!target.example) return null;
    const ds = pickDistractors(target, all, 3, rng, { samePos: true, filter: (e) => e.pos === target.pos });
    if (ds.length < 2) return null;
    return {
      target,
      sentence: blankOut(target.example.en, exampleForm(target)),
      translation: target.example.vi,
      baseFormNote: !!target.example.form && target.example.form.toLowerCase() !== target.word.toLowerCase(),
      options: shuffle([target, ...ds], rng).map((e) => ({ key: e.id, label: e.word })),
    };
  },
  Component: ContextMaster,
};
