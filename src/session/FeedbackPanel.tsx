import type { ReactNode } from 'react';
import { VOCAB } from '../data/words';
import { POS_SHORT, meaningText } from '../modes/shared';
import type { GradedResult, ModeRuntime } from '../modes/types';
import { AudioButton } from '../ui/components/AudioButton';

interface Props {
  items: { id: string; r?: GradedResult; gained: number }[];
  runtime: ModeRuntime;
  children: ReactNode;
}

const LABEL = { correct: 'Correct', wrong: 'Not quite', unsure: "Marked as I don't know" } as const;

/** Immediate feedback after each question: the right answer, what was given, and the example. */
export function FeedbackPanel({ items, runtime, children }: Props) {
  const allOk = items.every((i) => i.r?.result === 'correct');
  return (
    <section className={`card feedback ${allOk ? 'ok' : 'review'}`} aria-label="Feedback">
      <ul className="feedback-list">
        {items.map(({ id, r, gained }) => {
          const e = VOCAB.get(id);
          if (!e) return null;
          const result = r?.result;
          return (
            <li key={id} className={`feedback-item ${result ?? 'skipped'}`}>
              <span className="fb-icon" aria-hidden="true">
                {result === 'correct' ? '✅' : result === 'unsure' ? '🤔' : result === 'wrong' ? '❌' : '⏭️'}
              </span>
              <div className="fb-body">
                <p className="fb-title">
                  <strong>{result ? LABEL[result] : 'Not graded'}</strong>
                  {gained > 0 && <span className="gain"> +{gained}</span>}
                </p>
                <p className="fb-word">
                  <span lang="en" className="fb-en">{e.word}</span> <span className="pos-chip">{POS_SHORT[e.pos]}</span>
                  {e.ipa && <span className="ipa"> {e.ipa}</span>}
                  {runtime.audioAvailable && (
                    <AudioButton onPlay={(slow) => runtime.speak(e.word, { slow })} label={`Pronounce ${e.word}`} showSlow={false} />
                  )}
                </p>
                <p className="fb-meaning">{meaningText(e)}</p>
                {r?.given && result !== 'correct' && (
                  <p className="fb-given">
                    Your answer: <span className="strike">{r.given}</span>
                  </p>
                )}
                {e.example && result !== 'correct' && (
                  <p className="fb-example">
                    <span lang="en">“{e.example.en}”</span>
                    {e.example.vi && <span className="muted"> — {e.example.vi}</span>}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="feedback-actions">{children}</div>
    </section>
  );
}
