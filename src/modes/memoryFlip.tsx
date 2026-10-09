import { useEffect, useRef, useState } from 'react';
import { playSfx } from '../ui/sfx';
import { overlaps } from '../core/distractors';
import { shuffle } from '../core/rng';
import type { VocabEntry } from '../core/types';
import { Instruction, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Card {
  id: string;
  pairId: string;
  face: 'word' | 'meaning';
  text: string;
}
interface Q {
  targets: VocabEntry[];
  cards: Card[];
}

/**
 * Grading rule: a word counts as missed when a mismatch involves one of its
 * cards while its partner card had already been seen — i.e. the learner could
 * have remembered where it was.
 */
export function mismatchMisses(a: Card, b: Card, cards: Card[], seenBefore: Set<string>): string[] {
  const out: string[] = [];
  for (const c of [a, b]) {
    const partner = cards.find((x) => x.pairId === c.pairId && x.id !== c.id)!;
    if (seenBefore.has(partner.id)) out.push(c.pairId);
  }
  return out;
}

function MemoryFlip({ question, runtime, report, done, revealed }: ModeProps<Q>) {
  const { cards, targets } = question;
  const [open, setOpen] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const seen = useRef(new Set<string>());
  const missed = useRef(new Set<string>());
  const busy = useRef(false);
  const finished = useRef(false);

  useEffect(() => {
    if (!finished.current && matched.size === targets.length) {
      finished.current = true;
      done();
    }
  }, [matched, targets.length, done]);

  const flip = (c: Card) => {
    if (revealed || busy.current || matched.has(c.pairId) || open.includes(c.id)) return;
    playSfx('flip');
    const next = [...open, c.id];
    setOpen(next);
    if (next.length < 2) return;
    setMoves((m) => m + 1);
    const [a, b] = next.map((id) => cards.find((x) => x.id === id)!);
    const seenBefore = new Set(seen.current);
    seen.current.add(a.id);
    seen.current.add(b.id);
    if (a.pairId === b.pairId) {
      const m = new Set(matched);
      m.add(a.pairId);
      setMatched(m);
      setOpen([]);
      report({ vocabId: a.pairId, result: missed.current.has(a.pairId) ? 'wrong' : 'correct', given: missed.current.has(a.pairId) ? 'mismatched after seeing both cards' : undefined });
    } else {
      for (const id of mismatchMisses(a, b, cards, seenBefore)) missed.current.add(id);
      busy.current = true;
      setTimeout(() => {
        busy.current = false;
        setOpen([]);
      }, runtime.reduceMotion ? 700 : 900);
    }
  };

  return (
    <div className="mode memory-flip">
      <Instruction>Flip two cards at a time to find each word and its meaning. Remember where they are!</Instruction>
      <div className={`memory-grid n${cards.length}`}>
        {cards.map((c) => {
          const up = open.includes(c.id) || matched.has(c.pairId) || revealed;
          return (
            <button
              key={c.id}
              type="button"
              className={`memory-card ${up ? 'up' : ''} ${matched.has(c.pairId) ? 'matched' : ''} ${c.face}`}
              onClick={() => flip(c)}
              aria-label={up ? c.text : 'Hidden card'}
              aria-pressed={up}
            >
              {up ? <span lang={c.face === 'word' ? 'en' : 'vi'}>{c.text}</span> : <span aria-hidden="true">❓</span>}
            </button>
          );
        })}
      </div>
      <p className="muted small center" aria-live="polite">
        {matched.size}/{targets.length} pairs · {moves} moves
      </p>
    </div>
  );
}

export const memoryFlip: ModeDef<Q> = {
  id: 'memory-flip',
  name: 'Memory Flip',
  icon: '🃏',
  skill: 'arcade',
  weight: 'recognition',
  blurb: 'Classic concentration: uncover matching word–meaning pairs.',
  targetsPerQuestion: 6,
  minTargets: 3,
  isEligible: () => true,
  build: (targets, { rng }) => {
    if (targets.length < 3) return null;
    for (let i = 0; i < targets.length; i++)
      for (let j = i + 1; j < targets.length; j++) if (overlaps(targets[i], targets[j])) return null;
    const cards: Card[] = targets.flatMap((t) => [
      { id: `${t.id}:w`, pairId: t.id, face: 'word' as const, text: t.word },
      { id: `${t.id}:m`, pairId: t.id, face: 'meaning' as const, text: meaningText(t) },
    ]);
    return { targets, cards: shuffle(cards, rng) };
  },
  Component: MemoryFlip,
};
