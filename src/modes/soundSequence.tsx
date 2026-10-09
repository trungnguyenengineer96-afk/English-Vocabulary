import { useEffect, useRef, useState } from 'react';
import { overlaps, pickDistractors } from '../core/distractors';
import { shuffle } from '../core/rng';
import type { VocabEntry } from '../core/types';
import { AudioButton } from '../ui/components/AudioButton';
import { Instruction } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  /** Targets in the order they are spoken. */
  targets: VocabEntry[];
  /** Tiles: targets plus decoys, shuffled. */
  tiles: { id: string; word: string }[];
}

function SoundSequence({ question, runtime, report, done, revealed }: ModeProps<Q>) {
  const { targets, tiles } = question;
  const [seq, setSeq] = useState<string[]>([]);
  const sent = useRef(false);
  const playAll = async (slow = false) => {
    for (const t of targets) {
      await runtime.speak(t.word, { slow });
      await new Promise((r) => setTimeout(r, 350));
    }
  };
  useEffect(() => {
    void playAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);
  const submit = () => {
    if (sent.current) return;
    sent.current = true;
    const byId = new Map(tiles.map((t) => [t.id, t.word]));
    targets.forEach((t, i) => {
      const ok = seq[i] === t.id;
      report({ vocabId: t.id, result: ok ? 'correct' : 'wrong', given: ok ? undefined : `position ${i + 1}: ${byId.get(seq[i]) ?? '—'}` });
    });
    done();
  };
  return (
    <div className="mode sound-sequence">
      <Instruction>Listen to {targets.length} words, then tap them in the order you heard them.</Instruction>
      <div className="listen-stage">
        <AudioButton big onPlay={(slow) => playAll(slow)} label="Play the sequence" />
      </div>
      <ol className="sequence-slots" aria-label="Your order">
        {targets.map((t, i) => {
          const id = seq[i];
          const ok = revealed && id === t.id;
          return (
            <li key={i} className={`seq-slot ${revealed ? (ok ? 'ok' : 'bad') : ''}`}>
              <span className="seq-num">{i + 1}</span>
              <span lang="en">{id ? tiles.find((x) => x.id === id)?.word : '…'}</span>
              {revealed && !ok && <span className="muted small"> → {t.word}</span>}
            </li>
          );
        })}
      </ol>
      <div className="tile-pool" role="group" aria-label="Words">
        {tiles.map((t) => (
          <button
            key={t.id}
            type="button"
            className="tile"
            lang="en"
            disabled={revealed || seq.includes(t.id) || seq.length >= targets.length}
            onClick={() => setSeq([...seq, t.id])}
          >
            {t.word}
          </button>
        ))}
      </div>
      {!revealed && (
        <div className="row center">
          <button type="button" className="btn small ghost" onClick={() => setSeq(seq.slice(0, -1))} disabled={!seq.length}>Undo</button>
          <button type="button" className="btn primary" onClick={submit} disabled={seq.length < targets.length}>Check</button>
        </div>
      )}
    </div>
  );
}

export const soundSequence: ModeDef<Q> = {
  id: 'sound-sequence',
  name: 'Sound Sequence',
  icon: '🎼',
  skill: 'listening',
  weight: 'listening',
  blurb: 'Hear three words in a row and rebuild the order, ignoring decoys.',
  targetsPerQuestion: 3,
  minTargets: 2,
  requiresAudio: true,
  isEligible: (_e, ctx) => ctx.audioAvailable,
  build: (targets, { all, rng, audioAvailable }) => {
    if (!audioAvailable || targets.length < 2) return null;
    for (let i = 0; i < targets.length; i++)
      for (let j = i + 1; j < targets.length; j++)
        if (targets[i].word.toLowerCase() === targets[j].word.toLowerCase()) return null;
    const exclude = new Set(targets.map((t) => t.id));
    const decoys = pickDistractors(targets[0], all, 2, rng, {
      similarSpelling: true,
      exclude,
      filter: (e) => targets.every((t) => !overlaps(t, e)),
    });
    const tiles = shuffle(
      [...targets.map((t) => ({ id: t.id, word: t.word })), ...decoys.map((d) => ({ id: d.id, word: d.word }))],
      rng,
    );
    return { targets, tiles };
  },
  Component: SoundSequence,
};
