import { answersMatch, blankOut, surfaceForm } from '../core/text';
import type { VocabEntry } from '../core/types';
import { TextAnswer } from '../ui/components/TextAnswer';
import { Instruction, exampleForm } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
  vi: string;
  blanked: string;
  expected: string;
}

function TranslationChallenge({ question, report, done, revealed }: ModeProps<Q>) {
  const { target, expected } = question;
  const [before, after] = question.blanked.split('_____');
  return (
    <div className="mode translation-challenge">
      <Instruction>Translate: write the missing English word so the sentence matches the Vietnamese.</Instruction>
      <p className="vi-sentence">🇻🇳 {question.vi}</p>
      <p className="sentence" lang="en">
        🇬🇧 {before}
        <span className={`blank ${revealed ? 'filled' : ''}`}>{revealed ? expected : `${expected[0]}…`}</span>
        {after}
      </p>
      <TextAnswer
        expected={expected}
        revealed={revealed}
        label="Missing English word"
        hint={expected.toLowerCase() !== target.word.toLowerCase() ? `Use the correct form of the word.` : undefined}
        onSubmit={(v) => {
          const ok = answersMatch(v, expected);
          report({ vocabId: target.id, result: ok ? 'correct' : 'wrong', given: ok ? undefined : v });
          done();
        }}
      />
    </div>
  );
}

export const translationChallenge: ModeDef<Q> = {
  id: 'translation-challenge',
  name: 'Translation Challenge',
  icon: '🌏',
  skill: 'writing',
  weight: 'production',
  blurb: 'Use a Vietnamese sentence to write the missing English word.',
  targetsPerQuestion: 1,
  isEligible: (e) => !!e.example?.vi && !!surfaceForm(e.example.en, exampleForm(e)),
  build: ([target]) => {
    const ex = target.example;
    if (!ex?.vi) return null;
    const form = surfaceForm(ex.en, exampleForm(target));
    if (!form) return null;
    return { target, vi: ex.vi, blanked: blankOut(ex.en, form), expected: form };
  },
  Component: TranslationChallenge,
};
