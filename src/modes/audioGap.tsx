import { useEffect } from 'react';
import { answersMatch, blankOut, surfaceForm } from '../core/text';
import type { VocabEntry } from '../core/types';
import { AudioButton } from '../ui/components/AudioButton';
import { TextAnswer } from '../ui/components/TextAnswer';
import { Instruction, exampleForm } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
  sentence: string;
  blanked: string;
  expected: string;
}

function AudioGap({ question, runtime, report, done, revealed }: ModeProps<Q>) {
  const { target, expected } = question;
  const [before, after] = question.blanked.split('_____');
  useEffect(() => {
    void runtime.speak(question.sentence);
  }, [question, runtime]);
  return (
    <div className="mode audio-gap">
      <Instruction>Listen to the sentence and type the missing word.</Instruction>
      <div className="listen-stage">
        <AudioButton big onPlay={(slow) => runtime.speak(question.sentence, { slow })} label="Play the sentence" />
      </div>
      <p className="sentence" lang="en">
        {before}
        <span className={`blank ${revealed ? 'filled' : ''}`}>{revealed ? expected : ' '.repeat(8)}</span>
        {after}
      </p>
      <TextAnswer
        expected={expected}
        revealed={revealed}
        label="Missing word"
        onSubmit={(v) => {
          const ok = answersMatch(v, expected);
          report({ vocabId: target.id, result: ok ? 'correct' : 'wrong', given: ok ? undefined : v });
          done();
        }}
      />
      {revealed && target.example?.vi && <p className="translation">{target.example.vi}</p>}
    </div>
  );
}

export const audioGap: ModeDef<Q> = {
  id: 'audio-gap',
  name: 'Audio Gap',
  icon: '🕳️',
  skill: 'listening',
  weight: 'production',
  blurb: 'Hear a full sentence and fill the gap with the word you heard.',
  targetsPerQuestion: 1,
  requiresAudio: true,
  isEligible: (e, ctx) => ctx.audioAvailable && !!e.example && !!surfaceForm(e.example.en, exampleForm(e)),
  build: ([target], { audioAvailable }) => {
    if (!audioAvailable || !target.example) return null;
    const form = surfaceForm(target.example.en, exampleForm(target));
    if (!form) return null;
    return { target, sentence: target.example.en, blanked: blankOut(target.example.en, form), expected: form };
  },
  Component: AudioGap,
};
