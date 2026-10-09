import { useState } from 'react';
import { isWordToken, surfaceForm, tokenize } from '../core/text';
import type { VocabEntry } from '../core/types';
import { Instruction, exampleForm, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
  tokens: string[];
  answerIndex: number;
}

function SentenceDetective({ question, report, done, revealed }: ModeProps<Q>) {
  const { target, tokens, answerIndex } = question;
  const [picked, setPicked] = useState<number | null>(null);
  const pick = (i: number) => {
    if (revealed) return;
    setPicked(i);
    const ok = i === answerIndex;
    report({ vocabId: target.id, result: ok ? 'correct' : 'wrong', given: ok ? undefined : tokens[i] });
    done();
  };
  return (
    <div className="mode sentence-detective">
      <Instruction>🔍 Find the word in this sentence that means:</Instruction>
      <p className="vi-meaning">“{meaningText(target)}”</p>
      <p className="sentence detective" lang="en">
        {tokens.map((t, i) =>
          isWordToken(t) ? (
            <button
              key={i}
              type="button"
              className={`token ${revealed && i === answerIndex ? 'is-correct' : ''} ${revealed && i === picked && i !== answerIndex ? 'is-wrong' : ''}`}
              onClick={() => pick(i)}
              aria-disabled={revealed}
            >
              {t}
            </button>
          ) : (
            <span key={i}>{t}</span>
          ),
        )}
      </p>
      {revealed && target.example?.vi && <p className="translation">{target.example.vi}</p>}
    </div>
  );
}

export const sentenceDetective: ModeDef<Q> = {
  id: 'sentence-detective',
  name: 'Sentence Detective',
  icon: '🕵️',
  skill: 'reading',
  weight: 'recognition',
  blurb: 'Spot which word in a real sentence carries a given meaning.',
  targetsPerQuestion: 1,
  isEligible: (e) => !!e.example && !!surfaceForm(e.example.en, exampleForm(e)),
  build: ([target]) => {
    if (!target.example) return null;
    const form = surfaceForm(target.example.en, exampleForm(target));
    if (!form) return null;
    const tokens = tokenize(target.example.en);
    const answerIndex = tokens.findIndex((t) => t.toLowerCase() === form.toLowerCase());
    if (answerIndex < 0 || tokens.filter(isWordToken).length < 4) return null;
    return { target, tokens, answerIndex };
  },
  Component: SentenceDetective,
};
