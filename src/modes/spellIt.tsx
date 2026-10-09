import { useState } from 'react';
import { answersMatch } from '../core/text';
import type { VocabEntry } from '../core/types';
import { AudioButton } from '../ui/components/AudioButton';
import { TextAnswer } from '../ui/components/TextAnswer';
import { Instruction, POS_VI, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
}

function SpellIt({ question, runtime, report, done, revealed }: ModeProps<Q>) {
  const t = question.target;
  const [hint, setHint] = useState(false);
  return (
    <div className="mode spell-it">
      <Instruction>Spell the English word.</Instruction>
      <div className="clue-card">
        <p className="vi-meaning">{meaningText(t)}</p>
        <p className="clue-meta">
          ({POS_VI[t.pos]}){t.ipa ? <span className="ipa"> {t.ipa}</span> : null}
          {runtime.audioAvailable && <AudioButton onPlay={(slow) => runtime.speak(t.word, { slow })} label="Hear the word" />}
        </p>
      </div>
      <TextAnswer
        expected={t.word}
        revealed={revealed}
        label="English spelling"
        showLength
        hint={hint ? `Starts with “${t.word[0]}”` : undefined}
        onSubmit={(v) => {
          const ok = answersMatch(v, t.word);
          report({ vocabId: t.id, result: ok ? 'correct' : 'wrong', given: ok ? undefined : v, hintUsed: hint });
          done();
        }}
      />
      {!revealed && !hint && (
        <button type="button" className="btn ghost small" onClick={() => setHint(true)}>
          💡 Hint (half points)
        </button>
      )}
      {revealed && <p className="answer-reveal" lang="en">{t.word}</p>}
    </div>
  );
}

export const spellIt: ModeDef<Q> = {
  id: 'spell-it',
  name: 'Spell It',
  icon: '✍️',
  skill: 'writing',
  weight: 'production',
  blurb: 'Read the Vietnamese meaning and type the English word.',
  targetsPerQuestion: 1,
  isEligible: () => true,
  build: ([target]) => ({ target }),
  Component: SpellIt,
};
