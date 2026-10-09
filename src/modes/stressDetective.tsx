import { useEffect, useState } from 'react';
import type { VocabEntry } from '../core/types';
import { AudioButton } from '../ui/components/AudioButton';
import { Instruction, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
}

function StressDetective({ question, runtime, report, done, revealed }: ModeProps<Q>) {
  const t = question.target;
  const syl = t.syllables!;
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => {
    void runtime.speak(t.word);
  }, [t, runtime]);
  return (
    <div className="mode stress-detective">
      <Instruction>Listen. Which syllable is stressed (said loudest)?</Instruction>
      <div className="listen-stage">
        <AudioButton big onPlay={(slow) => runtime.speak(t.word, { slow })} label="Play the word" />
      </div>
      <div className="syllables" role="group" aria-label={`Syllables of ${t.word}`} lang="en">
        {syl.map((s, i) => (
          <button
            key={i}
            type="button"
            className={`syllable ${revealed && i === t.stressIndex ? 'is-correct stressed' : ''} ${revealed && i === picked && i !== t.stressIndex ? 'is-wrong' : ''}`}
            aria-disabled={revealed}
            onClick={() => {
              if (revealed) return;
              setPicked(i);
              const ok = i === t.stressIndex;
              report({ vocabId: t.id, result: ok ? 'correct' : 'wrong', given: ok ? undefined : `stress on “${s}”` });
              done();
            }}
          >
            {s}
          </button>
        ))}
      </div>
      {revealed && (
        <p className="explain">
          <span className="ipa">{t.ipa}</span> — the mark ˈ comes before the stressed syllable. {meaningText(t)}
        </p>
      )}
    </div>
  );
}

export const stressDetective: ModeDef<Q> = {
  id: 'stress-detective',
  name: 'Stress Detective',
  icon: '🥁',
  skill: 'listening',
  weight: 'listening',
  blurb: 'Hear a word and tap the syllable that carries the stress.',
  targetsPerQuestion: 1,
  requiresAudio: true,
  isEligible: (e, ctx) => ctx.audioAvailable && (e.syllables?.length ?? 0) >= 2 && e.stressIndex !== undefined,
  build: ([target], { audioAvailable }) =>
    audioAvailable && target.syllables && target.syllables.length >= 2 && target.stressIndex !== undefined ? { target } : null,
  Component: StressDetective,
};
