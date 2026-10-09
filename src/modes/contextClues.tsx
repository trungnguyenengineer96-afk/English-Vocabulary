import { useState } from 'react';
import { pickDistractors } from '../core/distractors';
import { shuffle } from '../core/rng';
import { surfaceForm } from '../core/text';
import type { VocabEntry } from '../core/types';
import { Options } from '../ui/components/Options';
import { Instruction, exampleForm, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
  before: string;
  form: string;
  after: string;
  options: { key: string; label: string }[];
}

function ContextClues({ question, report, done, revealed }: ModeProps<Q>) {
  const { target } = question;
  const [chosen, setChosen] = useState<string | null>(null);
  const [clue, setClue] = useState(false);
  return (
    <div className="mode context-clues">
      <Instruction>Read the sentence. What does the highlighted word mean here?</Instruction>
      <p className="sentence" lang="en">
        {question.before}
        <mark className="highlight">{question.form}</mark>
        {question.after}
      </p>
      {(clue || revealed) && target.definitionEn && (
        <p className="clue-box" lang="en">
          <span aria-hidden="true">🗝️</span> Definition: {target.definitionEn}
        </p>
      )}
      {!clue && !revealed && target.definitionEn && (
        <button type="button" className="btn ghost small" onClick={() => setClue(true)}>
          🗝️ Reveal an English clue (half points)
        </button>
      )}
      <Options
        options={question.options}
        correctKey={target.id}
        chosen={chosen}
        revealed={revealed}
        onChoose={(k) => {
          setChosen(k);
          const ok = k === target.id;
          report({ vocabId: target.id, result: ok ? 'correct' : 'wrong', hintUsed: clue, given: question.options.find((o) => o.key === k)?.label });
          done();
        }}
      />
      {revealed && target.example?.vi && <p className="translation">{target.example.vi}</p>}
    </div>
  );
}

export const contextClues: ModeDef<Q> = {
  id: 'context-clues',
  name: 'Context Clues',
  icon: '🗝️',
  skill: 'reading',
  weight: 'recognition',
  blurb: 'Infer a highlighted word’s meaning from its sentence; spend a clue if stuck.',
  targetsPerQuestion: 1,
  isEligible: (e) => !!e.example && !!surfaceForm(e.example.en, exampleForm(e)),
  build: ([target], { all, rng }) => {
    if (!target.example) return null;
    const form = surfaceForm(target.example.en, exampleForm(target));
    if (!form) return null;
    const i = target.example.en.indexOf(form);
    const ds = pickDistractors(target, all, 3, rng, { samePos: true });
    if (ds.length < 2) return null;
    return {
      target,
      before: target.example.en.slice(0, i),
      form,
      after: target.example.en.slice(i + form.length),
      options: shuffle([target, ...ds], rng).map((e) => ({ key: e.id, label: meaningText(e) })),
    };
  },
  Component: ContextClues,
};
