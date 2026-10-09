import { useEffect, useRef, useState } from 'react';
import { sample } from '../core/rng';
import type { VocabEntry } from '../core/types';
import { Instruction, POS_VI, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
  /** Indexes of hidden letters. */
  hidden: number[];
}

function MissingLetters({ question, report, done, revealed }: ModeProps<Q>) {
  const { target, hidden } = question;
  const letters = Array.from(target.word);
  const [vals, setVals] = useState<Record<number, string>>({});
  const refs = useRef<Record<number, HTMLInputElement | null>>({});
  useEffect(() => {
    refs.current[hidden[0]]?.focus();
  }, [hidden]);
  const complete = hidden.every((i) => (vals[i] ?? '').length === 1);
  const submit = () => {
    if (revealed || !complete) return;
    const ok = hidden.every((i) => vals[i].toLowerCase() === letters[i].toLowerCase());
    const given = letters.map((ch, i) => (hidden.includes(i) ? vals[i] : ch)).join('');
    report({ vocabId: target.id, result: ok ? 'correct' : 'wrong', given: ok ? undefined : given });
    done();
  };
  const setAt = (i: number, v: string) => {
    const ch = v.slice(-1);
    setVals((s) => ({ ...s, [i]: ch }));
    if (ch) {
      const next = hidden[hidden.indexOf(i) + 1];
      if (next !== undefined) refs.current[next]?.focus();
    }
  };
  return (
    <div className="mode missing-letters">
      <Instruction>Fill in the missing letters.</Instruction>
      <p className="vi-meaning">
        {meaningText(target)} <span className="muted">({POS_VI[target.pos]})</span>
      </p>
      <form
        className="letter-row"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        aria-label="Word with missing letters"
      >
        <div className="letters" lang="en">
          {letters.map((ch, i) =>
            hidden.includes(i) ? (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className={`letter-input ${revealed ? (vals[i]?.toLowerCase() === ch.toLowerCase() ? 'ok' : 'bad') : ''}`}
                value={revealed && vals[i]?.toLowerCase() !== ch.toLowerCase() ? ch : vals[i] ?? ''}
                onChange={(e) => setAt(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !vals[i]) {
                    const prev = hidden[hidden.indexOf(i) - 1];
                    if (prev !== undefined) refs.current[prev]?.focus();
                  }
                }}
                maxLength={2}
                readOnly={revealed}
                aria-label={`Letter ${i + 1} of ${letters.length}`}
                autoComplete="off"
                autoCapitalize="off"
              />
            ) : (
              <span key={i} className="letter-fixed">
                {ch}
              </span>
            ),
          )}
        </div>
        <button type="submit" className="btn primary" disabled={revealed || !complete}>
          Check
        </button>
      </form>
    </div>
  );
}

export const missingLetters: ModeDef<Q> = {
  id: 'missing-letters',
  name: 'Missing Letters',
  icon: '🔡',
  skill: 'writing',
  weight: 'production',
  blurb: 'Restore the hidden letters of a word from its meaning.',
  targetsPerQuestion: 1,
  isEligible: (e) => /^[a-z]{4,}$/i.test(e.word),
  build: ([target], { rng }) => {
    const n = target.word.length;
    if (n < 4) return null;
    const positions = Array.from({ length: n - 1 }, (_, i) => i + 1); // keep first letter
    const count = Math.max(1, Math.min(n - 2, Math.round(n * 0.4)));
    return { target, hidden: sample(positions, count, rng).sort((a, b) => a - b) };
  },
  Component: MissingLetters,
};
