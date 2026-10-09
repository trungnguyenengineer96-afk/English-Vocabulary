import { useEffect, useState } from 'react';
import { pickDistractors } from '../core/distractors';
import { pick } from '../core/rng';
import type { VocabEntry } from '../core/types';
import { AudioButton } from '../ui/components/AudioButton';
import { Options } from '../ui/components/Options';
import { Instruction, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
  /** The two words played, in order. */
  pair: [string, string];
  same: boolean;
  /** True when the other word comes from the curated confusables list. */
  curated: boolean;
}

function SoundTwins({ question, runtime, report, done, revealed }: ModeProps<Q>) {
  const { target, pair, same } = question;
  const [chosen, setChosen] = useState<string | null>(null);
  const playBoth = async (slow = false) => {
    await runtime.speak(pair[0], { slow });
    await new Promise((r) => setTimeout(r, 450));
    await runtime.speak(pair[1], { slow });
  };
  useEffect(() => {
    void playBoth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);
  return (
    <div className="mode sound-twins">
      <Instruction>Two words are spoken. Are they the same word, or different words?</Instruction>
      <div className="twins">
        <div className="twin">
          <span className="twin-label">A</span>
          <AudioButton onPlay={(slow) => runtime.speak(pair[0], { slow })} label="Play word A" />
          {revealed && <span className="twin-word" lang="en">{pair[0]}</span>}
        </div>
        <div className="twin">
          <span className="twin-label">B</span>
          <AudioButton onPlay={(slow) => runtime.speak(pair[1], { slow })} label="Play word B" />
          {revealed && <span className="twin-word" lang="en">{pair[1]}</span>}
        </div>
      </div>
      <button type="button" className="btn small ghost center-self" onClick={() => playBoth()}>🔁 Play A then B</button>
      <Options
        options={[
          { key: 'same', label: '👯 Same word' },
          { key: 'diff', label: '🙅 Different words' },
        ]}
        correctKey={same ? 'same' : 'diff'}
        chosen={chosen}
        revealed={revealed}
        onChoose={(k) => {
          setChosen(k);
          const ok = (k === 'same') === same;
          report({ vocabId: target.id, result: ok ? 'correct' : 'wrong', given: ok ? undefined : k === 'same' ? 'same word' : 'different words' });
          done();
        }}
      />
      {revealed && (
        <p className="explain">
          <span lang="en">{target.word}</span> = {meaningText(target)}
          {!same && question.curated && ' — these two are commonly confused.'}
        </p>
      )}
    </div>
  );
}

export const soundTwins: ModeDef<Q> = {
  id: 'sound-twins',
  name: 'Sound Twins',
  icon: '👯',
  skill: 'listening',
  weight: 'listening',
  blurb: 'Listen closely: same word twice, or two sound-alikes?',
  targetsPerQuestion: 1,
  requiresAudio: true,
  isEligible: (_e, ctx) => ctx.audioAvailable,
  build: ([target], { all, rng, audioAvailable }) => {
    if (!audioAvailable) return null;
    const same = rng() < 0.4;
    let other = target.word;
    let curated = false;
    if (!same) {
      if (target.confusables?.length) {
        other = pick(target.confusables, rng);
        curated = true;
      } else {
        const [d] = pickDistractors(target, all, 1, rng, { similarSpelling: true });
        if (!d) return null;
        other = d.word;
      }
    }
    const pair: [string, string] = rng() < 0.5 ? [target.word, other] : [other, target.word];
    return { target, pair, same, curated };
  },
  Component: SoundTwins,
};
