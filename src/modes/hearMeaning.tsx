import { useEffect, useState } from 'react';
import { pickDistractors } from '../core/distractors';
import { shuffle } from '../core/rng';
import type { VocabEntry } from '../core/types';
import { AudioButton } from '../ui/components/AudioButton';
import { Options } from '../ui/components/Options';
import { Instruction, WordHeading, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
  options: { key: string; label: string }[];
}

function HearMeaning({ question, runtime, report, done, revealed }: ModeProps<Q>) {
  const t = question.target;
  const [chosen, setChosen] = useState<string | null>(null);
  useEffect(() => {
    void runtime.speak(t.word);
  }, [t, runtime]);
  return (
    <div className="mode hear-meaning">
      <Instruction>Listen — no text! Pick what the word means.</Instruction>
      <div className="listen-stage">
        <AudioButton big onPlay={(slow) => runtime.speak(t.word, { slow })} label="Play the word" />
      </div>
      {revealed && <WordHeading entry={t} runtime={runtime} />}
      <Options
        options={question.options}
        correctKey={t.id}
        chosen={chosen}
        revealed={revealed}
        onChoose={(k) => {
          setChosen(k);
          const ok = k === t.id;
          report({ vocabId: t.id, result: ok ? 'correct' : 'wrong', given: question.options.find((o) => o.key === k)?.label });
          done();
        }}
      />
    </div>
  );
}

export const hearMeaning: ModeDef<Q> = {
  id: 'hear-meaning',
  name: 'Hear the Meaning',
  icon: '👂',
  skill: 'listening',
  weight: 'listening',
  blurb: 'Hear a word without seeing it and choose its meaning.',
  targetsPerQuestion: 1,
  requiresAudio: true,
  isEligible: (_e, ctx) => ctx.audioAvailable,
  build: ([target], { all, rng, audioAvailable }) => {
    if (!audioAvailable) return null;
    const ds = pickDistractors(target, all, 3, rng);
    if (ds.length < 2) return null;
    return { target, options: shuffle([target, ...ds], rng).map((e) => ({ key: e.id, label: meaningText(e) })) };
  },
  Component: HearMeaning,
};
