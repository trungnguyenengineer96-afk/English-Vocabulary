import { useState } from 'react';
import { playSfx } from '../ui/sfx';
import { sample, shuffle } from '../core/rng';
import type { VocabEntry } from '../core/types';
import { Instruction, WordHeading } from './shared';
import type { ModeDef, ModeProps } from './types';

type Bin = 'similar' | 'opposite';
interface Q {
  target: VocabEntry;
  chips: { word: string; bin: Bin }[];
}

function OppositeSimilar({ question, runtime, report, done, revealed }: ModeProps<Q>) {
  const { target, chips } = question;
  const [placed, setPlaced] = useState<Record<string, Bin>>({});
  const all = chips.every((c) => placed[c.word]);
  const check = () => {
    const wrong = chips.filter((c) => placed[c.word] !== c.bin);
    report({
      vocabId: target.id,
      result: wrong.length ? 'wrong' : 'correct',
      given: wrong.length ? wrong.map((w) => `${w.word} → ${placed[w.word]}`).join('; ') : undefined,
    });
    done();
  };
  return (
    <div className="mode opposite-similar">
      <Instruction>Sort each word: similar to, or opposite of, the target?</Instruction>
      <WordHeading entry={target} runtime={runtime} />
      <ul className="sort-list">
        {chips.map((c) => {
          const p = placed[c.word];
          const state = revealed ? (p === c.bin ? 'ok' : 'bad') : '';
          return (
            <li key={c.word} className={`sort-row ${state}`}>
              <span className="sort-word" lang="en">{c.word}</span>
              <span className="sort-btns" role="radiogroup" aria-label={`${c.word}: similar or opposite`}>
                {(['similar', 'opposite'] as Bin[]).map((b) => (
                  <button
                    key={b}
                    type="button"
                    role="radio"
                    aria-checked={p === b}
                    className={`chip ${p === b ? 'active' : ''}`}
                    onClick={() => {
                      if (revealed) return;
                      playSfx('tap');
                      setPlaced({ ...placed, [c.word]: b });
                    }}
                  >
                    {b === 'similar' ? '≈ Similar' : '⇄ Opposite'}
                  </button>
                ))}
              </span>
              {revealed && p !== c.bin && <span className="muted small">→ {c.bin}</span>}
            </li>
          );
        })}
      </ul>
      {!revealed && (
        <button type="button" className="btn primary" onClick={check} disabled={!all}>
          Check
        </button>
      )}
    </div>
  );
}

export const oppositeSimilar: ModeDef<Q> = {
  id: 'opposite-similar',
  name: 'Opposite & Similar',
  icon: '⚖️',
  skill: 'reading',
  weight: 'recognition',
  blurb: 'Sort synonyms and antonyms of the target word into the right bins.',
  targetsPerQuestion: 1,
  isEligible: (e) => !!e.synonyms?.length && !!e.antonyms?.length,
  build: ([target], { rng }) => {
    if (!target.synonyms?.length || !target.antonyms?.length) return null;
    const syn = sample(target.synonyms, 2, rng).map((word) => ({ word, bin: 'similar' as Bin }));
    const ant = sample(target.antonyms, 2, rng).map((word) => ({ word, bin: 'opposite' as Bin }));
    return { target, chips: shuffle([...syn, ...ant], rng) };
  },
  Component: OppositeSimilar,
};
