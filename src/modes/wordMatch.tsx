import { useEffect, useRef, useState } from 'react';
import { playSfx } from '../ui/sfx';
import { overlaps } from '../core/distractors';
import { shuffle } from '../core/rng';
import type { VocabEntry } from '../core/types';
import { Instruction, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  targets: VocabEntry[];
  /** Order of meaning cards (ids). */
  meaningOrder: string[];
}

function WordMatch({ question, report, done, revealed }: ModeProps<Q>) {
  const { targets, meaningOrder } = question;
  const byId = new Map(targets.map((t) => [t.id, t]));
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<{ word: string; meaning: string } | null>(null);
  const missed = useRef(new Map<string, string>());
  const finished = useRef(false);

  useEffect(() => {
    if (!finished.current && matched.size === targets.length) {
      finished.current = true;
      done();
    }
  }, [matched, targets.length, done]);

  const pickMeaning = (mid: string) => {
    if (!selected || revealed || matched.has(mid)) return;
    if (mid === selected) {
      const m = new Set(matched);
      m.add(mid);
      setMatched(m);
      const miss = missed.current.get(selected);
      report({ vocabId: selected, result: miss ? 'wrong' : 'correct', given: miss });
      setSelected(null);
    } else {
      if (!missed.current.has(selected)) missed.current.set(selected, meaningText(byId.get(mid)!));
      setFlash({ word: selected, meaning: mid });
      setTimeout(() => setFlash(null), 600);
    }
  };

  return (
    <div className="mode word-match">
      <Instruction>Tap an English word, then its Vietnamese meaning. Match all pairs.</Instruction>
      <div className="match-grid">
        <div className="match-col" role="group" aria-label="English words">
          {targets.map((t) => {
            const done_ = matched.has(t.id) || revealed;
            return (
              <button
                key={t.id}
                type="button"
                lang="en"
                className={`match-card ${selected === t.id ? 'is-selected' : ''} ${matched.has(t.id) ? 'is-matched' : ''} ${flash?.word === t.id ? 'is-wrong' : ''}`}
                aria-pressed={selected === t.id}
                aria-disabled={done_}
                onClick={() => {
                  if (done_) return;
                  playSfx('tap');
                  setSelected(t.id);
                }}
              >
                {t.word}
                {revealed && !matched.has(t.id) && <span className="pair-reveal"> = {meaningText(t)}</span>}
              </button>
            );
          })}
        </div>
        <div className="match-col" role="group" aria-label="Vietnamese meanings">
          {meaningOrder.map((id) => (
            <button
              key={id}
              type="button"
              className={`match-card meaning ${matched.has(id) ? 'is-matched' : ''} ${flash?.meaning === id ? 'is-wrong' : ''}`}
              aria-disabled={matched.has(id) || revealed || !selected}
              onClick={() => pickMeaning(id)}
            >
              {meaningText(byId.get(id)!)}
            </button>
          ))}
        </div>
      </div>
      <p className="muted small" aria-live="polite">
        {matched.size}/{targets.length} matched
      </p>
    </div>
  );
}

export const wordMatch: ModeDef<Q> = {
  id: 'word-match',
  name: 'Word Match',
  icon: '🔗',
  skill: 'reading',
  weight: 'recognition',
  blurb: 'Pair five English words with their meanings. First-try matches count as correct.',
  targetsPerQuestion: 5,
  minTargets: 3,
  isEligible: () => true,
  build: (targets, { rng }) => {
    if (targets.length < 3) return null;
    // Two targets with overlapping meanings would make the board ambiguous.
    for (let i = 0; i < targets.length; i++)
      for (let j = i + 1; j < targets.length; j++) if (overlaps(targets[i], targets[j])) return null;
    return { targets, meaningOrder: shuffle(targets.map((t) => t.id), rng) };
  },
  Component: WordMatch,
};
