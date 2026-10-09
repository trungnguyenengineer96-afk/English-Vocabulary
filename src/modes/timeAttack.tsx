import { useCallback, useEffect, useRef, useState } from 'react';
import { pickDistractors } from '../core/distractors';
import { shuffle } from '../core/rng';
import type { VocabEntry } from '../core/types';
import { TimerBar, useCountdown } from '../ui/components/useTimer';
import { Instruction, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Item {
  target: VocabEntry;
  shown: string;
  isTrue: boolean;
}
interface Q {
  items: Item[];
  seconds: number;
}

function TimeAttack({ question, runtime, report, done, revealed }: ModeProps<Q>) {
  const { items, seconds } = question;
  const [i, setI] = useState(0);
  const [flash, setFlash] = useState<'ok' | 'no' | null>(null);
  const [started, setStarted] = useState(!runtime.timersEnabled);
  const finished = useRef(false);
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    done();
  }, [done]);
  const timer = useCountdown(seconds, runtime.timersEnabled, started && !revealed, finish);

  const answer = useCallback(
    (saysTrue: boolean) => {
      if (revealed || finished.current || i >= items.length) return;
      const it = items[i];
      const ok = saysTrue === it.isTrue;
      report({
        vocabId: it.target.id,
        result: ok ? 'correct' : 'wrong',
        given: ok ? undefined : `${it.target.word} = ${it.shown}? → ${saysTrue ? 'true' : 'false'}`,
        timeLeft: runtime.timersEnabled ? timer.fraction : undefined,
      });
      setFlash(ok ? 'ok' : 'no');
      setTimeout(() => setFlash(null), 250);
      if (i + 1 >= items.length) finish();
      else setI(i + 1);
    },
    [revealed, i, items, report, runtime.timersEnabled, timer.fraction, finish],
  );

  useEffect(() => {
    if (!started || revealed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'f') answer(false);
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 't') answer(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer, started, revealed]);

  if (!started) {
    return (
      <div className="mode time-attack">
        <Instruction>
          {items.length} true-or-false pairs in {seconds} seconds. Is the meaning right for the word? Use ← false / → true.
        </Instruction>
        <button type="button" className="btn primary big center-self" onClick={() => setStarted(true)} autoFocus>
          ⏱ Start!
        </button>
      </div>
    );
  }
  const it = items[Math.min(i, items.length - 1)];
  return (
    <div className="mode time-attack">
      {runtime.timersEnabled && <TimerBar fraction={timer.fraction} label={`${Math.ceil(timer.left)} seconds left`} />}
      <p className="muted small center">
        {Math.min(i + 1, items.length)}/{items.length}
        {runtime.timersEnabled ? ` · ${Math.ceil(timer.left)}s` : ' · practice mode: no timer'}
      </p>
      {!revealed ? (
        <div className={`ta-card ${flash ?? ''}`}>
          <p className="big-word center" lang="en">{it.target.word}</p>
          <p className="center">=</p>
          <p className="vi-meaning">{it.shown}</p>
        </div>
      ) : (
        <p className="center explain">
          {timer.left <= 0 && runtime.timersEnabled && i < items.length ? `⏰ Time! ${items.length - i} pair(s) left unanswered — they stay in your review queue.` : '🏁 Finished!'}
        </p>
      )}
      {!revealed && (
        <div className="tf-buttons">
          <button type="button" className="btn bad big" onClick={() => answer(false)}>✗ False <kbd>←</kbd></button>
          <button type="button" className="btn good big" onClick={() => answer(true)}>✓ True <kbd>→</kbd></button>
        </div>
      )}
    </div>
  );
}

export const timeAttack: ModeDef<Q> = {
  id: 'time-attack',
  name: 'Time Attack',
  icon: '⏱️',
  skill: 'arcade',
  weight: 'recognition',
  blurb: 'Rapid true/false: does the meaning match the word? Beat the clock.',
  targetsPerQuestion: 10,
  minTargets: 4,
  timed: true,
  isEligible: () => true,
  build: (targets, { all, rng }) => {
    if (targets.length < 4) return null;
    const items: Item[] = [];
    for (const t of targets) {
      const isTrue = rng() < 0.5;
      if (isTrue) items.push({ target: t, shown: meaningText(t), isTrue });
      else {
        const [d] = pickDistractors(t, all, 1, rng, { samePos: true });
        if (!d) return null;
        items.push({ target: t, shown: meaningText(d), isTrue });
      }
    }
    return { items: shuffle(items, rng), seconds: Math.max(30, targets.length * 6) };
  },
  Component: TimeAttack,
};
