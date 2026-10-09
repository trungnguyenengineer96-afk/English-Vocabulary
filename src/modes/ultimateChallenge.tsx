import { useState } from 'react';
import type { VocabEntry } from '../core/types';
import { ChallengeView, buildChallenge, type Challenge } from './challenges';
import { Instruction } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
  stages: Challenge[];
}

function UltimateChallenge({ question, report, done, revealed }: ModeProps<Q>) {
  const { target, stages } = question;
  const [stage, setStage] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const [passedStage, setPassedStage] = useState(false);

  const onResult = (ok: boolean, given?: string) => {
    if (!ok) {
      setFailed(given ?? '');
      report({ vocabId: target.id, result: 'wrong', given: `stage ${stage + 1}: ${given ?? ''}` });
      done();
      return;
    }
    if (stage + 1 >= stages.length) {
      report({ vocabId: target.id, result: 'correct' });
      done();
    } else setPassedStage(true);
  };

  return (
    <div className="mode ultimate-challenge">
      <Instruction>Pass all {stages.length} stages for the same word — spelling, context, then meaning. One slip ends the run.</Instruction>
      <ol className="stage-track">
        {stages.map((s, k) => (
          <li key={k} className={`stage ${k < stage || (k === stage && (passedStage || (revealed && !failed))) ? 'cleared' : ''} ${k === stage ? 'here' : ''} ${failed !== null && k === stage ? 'failed' : ''}`}>
            {k + 1}. {s.kind === 'spell' ? 'Spell' : s.kind === 'context' ? 'Context' : 'Meaning'}
          </li>
        ))}
      </ol>
      <ChallengeView key={stage} c={stages[stage]} onResult={onResult} locked={revealed} />
      {passedStage && !revealed && (
        <button
          type="button"
          className="btn primary center-self"
          autoFocus
          onClick={() => {
            setPassedStage(false);
            setStage(stage + 1);
          }}
        >
          Stage cleared — next ➜
        </button>
      )}
    </div>
  );
}

export const ultimateChallenge: ModeDef<Q> = {
  id: 'ultimate-challenge',
  name: 'Ultimate Challenge',
  icon: '👑',
  skill: 'arcade',
  weight: 'production',
  blurb: 'Three back-to-back stages on one word. Only a clean sweep counts.',
  targetsPerQuestion: 1,
  isEligible: (e) => !!e.example,
  build: ([target], { all, rng }) => {
    const stages = [
      buildChallenge('spell', target, all, rng),
      buildChallenge('context', target, all, rng),
      buildChallenge('meaning', target, all, rng),
    ];
    if (stages.some((s) => !s)) return null;
    return { target, stages: stages as Challenge[] };
  },
  Component: UltimateChallenge,
};
