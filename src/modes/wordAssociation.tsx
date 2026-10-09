import { useState } from 'react';
import { pickDistractors } from '../core/distractors';
import { pick, shuffle } from '../core/rng';
import type { VocabEntry } from '../core/types';
import { Options } from '../ui/components/Options';
import { Instruction, POS_SHORT } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Clue {
  kind: string;
  text: string;
}
interface Q {
  target: VocabEntry;
  clues: Clue[];
  options: { key: string; label: string }[];
}

const mask = (phrase: string, word: string) => phrase.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '____');

function clueList(e: VocabEntry, rng: () => number): Clue[] {
  const out: Clue[] = [];
  if (e.synonyms?.length) out.push({ kind: 'Similar word', text: pick(e.synonyms, rng) });
  if (e.collocations?.length) out.push({ kind: 'Goes with', text: mask(pick(e.collocations, rng), e.word) });
  if (e.definitionEn) out.push({ kind: 'Definition', text: mask(e.definitionEn, e.word) });
  if (e.antonyms?.length) out.push({ kind: 'Opposite', text: pick(e.antonyms, rng) });
  // Family members reveal the stem, so they come last.
  const fam = e.family?.filter((f) => !f.word.toLowerCase().startsWith(e.word.toLowerCase().slice(0, 4)) || out.length < 2);
  if (fam?.length) {
    const f = pick(fam, rng);
    out.push({ kind: 'Word family', text: `${f.word} (${POS_SHORT[f.pos]})` });
  }
  return out.slice(0, 3);
}

function WordAssociation({ question, report, done, revealed }: ModeProps<Q>) {
  const { target, clues } = question;
  const [shown, setShown] = useState(1);
  const [chosen, setChosen] = useState<string | null>(null);
  const visible = revealed ? clues.length : shown;
  return (
    <div className="mode word-association">
      <Instruction>Which word links all the clues? Fewer clues = more points.</Instruction>
      <ol className="clue-list">
        {clues.slice(0, visible).map((c, i) => (
          <li key={i} className="clue-item">
            <span className="clue-kind">{c.kind}</span> <span lang="en">{c.text}</span>
          </li>
        ))}
        {!revealed &&
          clues.slice(visible).map((_, i) => (
            <li key={`h${i}`} className="clue-item hidden-clue" aria-hidden="true">
              ? ? ?
            </li>
          ))}
      </ol>
      {!revealed && shown < clues.length && (
        <button type="button" className="btn ghost small" onClick={() => setShown(shown + 1)}>
          ➕ Reveal next clue {shown === 1 ? '(half points)' : ''}
        </button>
      )}
      <Options
        options={question.options}
        correctKey={target.id}
        chosen={chosen}
        revealed={revealed}
        onChoose={(k) => {
          setChosen(k);
          const ok = k === target.id;
          report({ vocabId: target.id, result: ok ? 'correct' : 'wrong', hintUsed: shown > 1, given: question.options.find((o) => o.key === k)?.label });
          done();
        }}
      />
    </div>
  );
}

export const wordAssociation: ModeDef<Q> = {
  id: 'word-association',
  name: 'Word Association',
  icon: '🕸️',
  skill: 'reading',
  weight: 'recognition',
  blurb: 'Guess the word from linked clues revealed one by one.',
  targetsPerQuestion: 1,
  isEligible: (e) => clueList(e, () => 0).length >= 2,
  build: ([target], { all, rng }) => {
    const clues = clueList(target, rng);
    if (clues.length < 2) return null;
    const ds = pickDistractors(target, all, 3, rng, { samePos: true });
    if (ds.length < 2) return null;
    return { target, clues, options: shuffle([target, ...ds], rng).map((e) => ({ key: e.id, label: e.word })) };
  },
  Component: WordAssociation,
};
