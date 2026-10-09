import { useEffect, useState } from 'react';
import { pickDistractors } from '../core/distractors';
import { shuffle } from '../core/rng';
import type { VocabEntry } from '../core/types';
import { Instruction, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Room {
  target: VocabEntry;
  doors: { id: string; word: string }[];
}
interface Q {
  rooms: Room[];
}

const ARROWS = ['←', '↑', '→'];
const KEYS = ['ArrowLeft', 'ArrowUp', 'ArrowRight'];

function WordMaze({ question, report, done, revealed }: ModeProps<Q>) {
  const { rooms } = question;
  const [room, setRoom] = useState(0);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [missed, setMissed] = useState<Set<string>>(new Set());
  const [escaped, setEscaped] = useState(false);
  const current = rooms[Math.min(room, rooms.length - 1)];

  const choose = (doorId: string) => {
    if (revealed || escaped || blocked.has(doorId)) return;
    const t = current.target;
    if (doorId === t.id) {
      if (!missed.has(t.id)) report({ vocabId: t.id, result: 'correct' });
      setBlocked(new Set());
      if (room + 1 >= rooms.length) {
        setEscaped(true);
        done();
      } else setRoom(room + 1);
    } else {
      if (!missed.has(t.id)) {
        report({ vocabId: t.id, result: 'wrong', given: current.doors.find((d) => d.id === doorId)?.word });
        setMissed(new Set(missed).add(t.id));
      }
      setBlocked(new Set(blocked).add(doorId));
    }
  };

  useEffect(() => {
    if (revealed || escaped) return;
    const onKey = (e: KeyboardEvent) => {
      const k = KEYS.indexOf(e.key);
      if (k >= 0 && current.doors[k]) {
        e.preventDefault();
        choose(current.doors[k].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="mode word-maze">
      <Instruction>Escape the maze! Each door is labelled with a word — go through the one that matches the meaning.</Instruction>
      <ol className="maze-track" aria-label={`Room ${room + 1} of ${rooms.length}`}>
        {rooms.map((r, i) => (
          <li key={r.target.id} className={`maze-room ${i < room || escaped ? 'cleared' : ''} ${i === room && !escaped ? 'here' : ''} ${missed.has(r.target.id) ? 'scarred' : ''}`}>
            {i === room && !escaped ? '🧭' : i < room || escaped ? '✓' : '·'}
          </li>
        ))}
        <li className={`maze-room exit ${escaped ? 'here' : ''}`}>{escaped ? '🏆' : '🚪'}</li>
      </ol>
      {!escaped && !revealed ? (
        <>
          <p className="vi-meaning">{meaningText(current.target)}</p>
          <div className="doors" role="group" aria-label="Doors">
            {current.doors.map((d, i) => (
              <button
                key={d.id}
                type="button"
                className={`door ${blocked.has(d.id) ? 'dead-end' : ''}`}
                onClick={() => choose(d.id)}
                aria-disabled={blocked.has(d.id)}
                lang="en"
              >
                <span className="door-arrow" aria-hidden="true">{ARROWS[i]}</span>
                <span>{d.word}</span>
                {blocked.has(d.id) && <span className="dead-label">dead end</span>}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="center explain">{escaped ? '🏆 You escaped the maze!' : '🧱 Maze closed.'}</p>
      )}
    </div>
  );
}

export const wordMaze: ModeDef<Q> = {
  id: 'word-maze',
  name: 'Word Maze',
  icon: '🏰',
  skill: 'arcade',
  weight: 'recognition',
  blurb: 'Navigate rooms by choosing the door with the right word. Dead ends cost the word.',
  targetsPerQuestion: 5,
  minTargets: 3,
  isEligible: () => true,
  build: (targets, { all, rng }) => {
    if (targets.length < 3) return null;
    const rooms: Room[] = [];
    for (const t of targets) {
      const ds = pickDistractors(t, all, 2, rng, { samePos: true });
      if (ds.length < 2) return null;
      rooms.push({ target: t, doors: shuffle([t, ...ds], rng).map((e) => ({ id: e.id, word: e.word })) });
    }
    return { rooms };
  },
  Component: WordMaze,
};
