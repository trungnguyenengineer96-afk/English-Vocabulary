import { useEffect } from 'react';
import { answersMatch } from '../core/text';
import type { VocabEntry } from '../core/types';
import { AudioButton } from '../ui/components/AudioButton';
import { TextAnswer } from '../ui/components/TextAnswer';
import { Instruction, WordHeading, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
}

function ListenType({ question, runtime, report, done, revealed }: ModeProps<Q>) {
  const t = question.target;
  useEffect(() => {
    void runtime.speak(t.word);
  }, [t, runtime]);
  return (
    <div className="mode listen-type">
      <Instruction>Listen and type the word you hear.</Instruction>
      <div className="listen-stage">
        <AudioButton big onPlay={(slow) => runtime.speak(t.word, { slow })} label="Play the word" />
      </div>
      <TextAnswer
        expected={t.word}
        revealed={revealed}
        label="Word you heard"
        onSubmit={(v) => {
          const ok = answersMatch(v, t.word);
          report({ vocabId: t.id, result: ok ? 'correct' : 'wrong', given: ok ? undefined : v });
          done();
        }}
      />
      {revealed && (
        <div className="reveal-block">
          <WordHeading entry={t} runtime={runtime} />
          <p className="vi-meaning small">{meaningText(t)}</p>
        </div>
      )}
    </div>
  );
}

export const listenType: ModeDef<Q> = {
  id: 'listen-type',
  name: 'Listen & Type',
  icon: '🎧',
  skill: 'listening',
  weight: 'production',
  blurb: 'Hear a word and type it correctly.',
  targetsPerQuestion: 1,
  requiresAudio: true,
  isEligible: (_e, ctx) => ctx.audioAvailable,
  build: ([target], { audioAvailable }) => (audioAvailable ? { target } : null),
  Component: ListenType,
};
