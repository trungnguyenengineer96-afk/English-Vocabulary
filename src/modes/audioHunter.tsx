import { useEffect, useState } from 'react';
import { pickDistractors } from '../core/distractors';
import { shuffle } from '../core/rng';
import type { VocabEntry } from '../core/types';
import { AudioButton } from '../ui/components/AudioButton';
import { Options } from '../ui/components/Options';
import { Instruction, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
  options: { key: string; label: string }[];
}

function AudioHunter({ question, runtime, report, done, revealed }: ModeProps<Q>) {
  const t = question.target;
  const [chosen, setChosen] = useState<string | null>(null);
  useEffect(() => {
    void runtime.speak(t.word);
  }, [t, runtime]);
  return (
    <div className="mode audio-hunter">
      <Instruction>Listen, then hunt down the spelling you heard among look-alikes.</Instruction>
      <div className="listen-stage">
        <AudioButton big onPlay={(slow) => runtime.speak(t.word, { slow })} label="Play the word" />
      </div>
      <Options
        options={question.options.map((o) => ({ ...o, label: <span lang="en" className="option-word">{o.label}</span>, ariaLabel: o.label }))}
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
      {revealed && <p className="vi-meaning small">{meaningText(t)}</p>}
    </div>
  );
}

export const audioHunter: ModeDef<Q> = {
  id: 'audio-hunter',
  name: 'Audio Hunter',
  icon: '🎯',
  skill: 'listening',
  weight: 'listening',
  blurb: 'Hear a word and pick its spelling from similar-looking words.',
  targetsPerQuestion: 1,
  requiresAudio: true,
  isEligible: (_e, ctx) => ctx.audioAvailable,
  build: ([target], { all, rng, audioAvailable }) => {
    if (!audioAvailable) return null;
    const ds = pickDistractors(target, all, 3, rng, { similarSpelling: true });
    if (ds.length < 2) return null;
    return { target, options: shuffle([target, ...ds], rng).map((e) => ({ key: e.id, label: e.word })) };
  },
  Component: AudioHunter,
};
