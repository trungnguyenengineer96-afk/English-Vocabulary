import { useEffect, useState } from 'react';
import type { VocabEntry } from '../core/types';
import { Instruction, POS_VI, WordHeading, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
}

function FlashRecall({ question, runtime, report, done, revealed }: ModeProps<Q>) {
  const t = question.target;
  const [flipped, setFlipped] = useState(false);
  const show = flipped || revealed;
  useEffect(() => {
    if (show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show]);
  const grade = (r: 'correct' | 'unsure' | 'wrong') => {
    report({ vocabId: t.id, result: r });
    done();
  };
  return (
    <div className="mode flash-recall">
      <Instruction>Recall the English word in your head, then flip the card and be honest.</Instruction>
      <div className={`flashcard ${show ? 'flipped' : ''}`}>
        <div className="flash-front" aria-hidden={show}>
          <p className="vi-meaning">{meaningText(t)}</p>
          <p className="muted">({POS_VI[t.pos]})</p>
        </div>
        {show && (
          <div className="flash-back">
            <WordHeading entry={t} runtime={runtime} />
            {t.example && <p className="sentence small" lang="en">{t.example.en}</p>}
          </div>
        )}
      </div>
      {!show && (
        <button type="button" className="btn primary" onClick={() => setFlipped(true)} autoFocus>
          Flip card <kbd>Space</kbd>
        </button>
      )}
      {show && !revealed && (
        <div className="self-grade" role="group" aria-label="How well did you remember?">
          <button type="button" className="btn good" onClick={() => grade('correct')} autoFocus>✓ I knew it</button>
          <button type="button" className="btn warn" onClick={() => grade('unsure')}>≈ Almost / unsure</button>
          <button type="button" className="btn bad" onClick={() => grade('wrong')}>✗ I didn't know</button>
        </div>
      )}
    </div>
  );
}

export const flashRecall: ModeDef<Q> = {
  id: 'flash-recall',
  name: 'Flash Recall',
  icon: '⚡',
  skill: 'arcade',
  weight: 'recognition',
  blurb: 'Active recall flashcards: think of the word, flip, and grade yourself.',
  targetsPerQuestion: 1,
  isEligible: () => true,
  build: ([target]) => ({ target }),
  Component: FlashRecall,
};
