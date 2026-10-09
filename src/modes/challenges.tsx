// Small reusable challenges used by multi-stage modes (Boss Battle, Ultimate Challenge).

import { useState } from 'react';
import { pickDistractors } from '../core/distractors';
import { shuffle, type Rng } from '../core/rng';
import { answersMatch, blankOut } from '../core/text';
import type { VocabEntry } from '../core/types';
import { Options } from '../ui/components/Options';
import { TextAnswer } from '../ui/components/TextAnswer';
import { POS_VI, exampleForm, meaningText } from './shared';

export type ChallengeKind = 'meaning' | 'context' | 'spell';

export interface Challenge {
  kind: ChallengeKind;
  target: VocabEntry;
  options?: { key: string; label: string }[];
  sentence?: string;
}

export function buildChallenge(kind: ChallengeKind, target: VocabEntry, all: VocabEntry[], rng: Rng): Challenge | null {
  if (kind === 'spell') return { kind, target };
  if (kind === 'context') {
    if (!target.example) return null;
    const ds = pickDistractors(target, all, 3, rng, { samePos: true, filter: (e) => e.pos === target.pos });
    if (ds.length < 2) return null;
    return {
      kind,
      target,
      sentence: blankOut(target.example.en, exampleForm(target)),
      options: shuffle([target, ...ds], rng).map((e) => ({ key: e.id, label: e.word })),
    };
  }
  const ds = pickDistractors(target, all, 3, rng, { samePos: true });
  if (ds.length < 2) return null;
  return { kind, target, options: shuffle([target, ...ds], rng).map((e) => ({ key: e.id, label: meaningText(e) })) };
}

export function ChallengeView({ c, onResult, locked }: { c: Challenge; onResult: (ok: boolean, given?: string) => void; locked?: boolean }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [answered, setDone] = useState(false);
  const done = answered || !!locked;
  const finish = (ok: boolean, given?: string) => {
    if (done) return;
    setDone(true);
    onResult(ok, given);
  };
  if (c.kind === 'spell') {
    return (
      <div className="challenge">
        <p className="challenge-label">✍️ Spell it</p>
        <p className="vi-meaning">{meaningText(c.target)} <span className="muted">({POS_VI[c.target.pos]})</span></p>
        <TextAnswer
          expected={c.target.word}
          revealed={done}
          label="English spelling"
          showLength
          onSubmit={(v) => finish(answersMatch(v, c.target.word), answersMatch(v, c.target.word) ? undefined : v)}
        />
      </div>
    );
  }
  const [before, after] = (c.sentence ?? '').split('_____');
  const pick = (k: string) => {
    setChosen(k);
    const ok = k === c.target.id;
    finish(ok, ok ? undefined : c.options!.find((o) => o.key === k)?.label);
  };
  return (
    <div className="challenge">
      {c.kind === 'context' ? (
        <>
          <p className="challenge-label">🧩 Complete the sentence</p>
          <p className="sentence" lang="en">
            {before}
            <span className="blank">{done ? exampleForm(c.target) : ' '.repeat(8)}</span>
            {after}
          </p>
        </>
      ) : (
        <>
          <p className="challenge-label">🏹 What does it mean?</p>
          <p className="big-word center" lang="en">{c.target.word}</p>
        </>
      )}
      <Options options={c.options!} correctKey={c.target.id} chosen={chosen} revealed={done} onChoose={pick} />
    </div>
  );
}
