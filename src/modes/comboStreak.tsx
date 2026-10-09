import { useCallback, useEffect, useRef, useState } from 'react';
import { pickDistractors } from '../core/distractors';
import { shuffle } from '../core/rng';
import { comboMultiplier } from '../core/scoring';
import type { VocabEntry } from '../core/types';
import { Options } from '../ui/components/Options';
import { TimerBar, useCountdown } from '../ui/components/useTimer';
import { Instruction, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Item {
  target: VocabEntry;
  dir: 'en-vi' | 'vi-en';
  options: { key: string; label: string }[];
}
interface Q {
  items: Item[];
  perItem: number;
}

function Step({ item, timed, perItem, onAnswer }: { item: Item; timed: boolean; perItem: number; onAnswer: (key: string | null, frac: number) => void }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const answered = useRef(false);
  const fire = (key: string | null, frac: number) => {
    if (answered.current) return;
    answered.current = true;
    setChosen(key);
    onAnswer(key, frac);
  };
  const timer = useCountdown(perItem, timed, chosen === null, () => fire(null, 0));
  return (
    <>
      {timed && <TimerBar fraction={timer.fraction} label={`${Math.ceil(timer.left)} seconds for this question`} />}
      <p className={item.dir === 'en-vi' ? 'big-word center' : 'vi-meaning'} lang={item.dir === 'en-vi' ? 'en' : 'vi'}>
        {item.dir === 'en-vi' ? item.target.word : meaningText(item.target)}
      </p>
      <Options
        options={item.options}
        correctKey={item.target.id}
        chosen={chosen}
        revealed={answered.current}
        columns={1}
        onChoose={(k) => fire(k, timer.fraction)}
      />
    </>
  );
}

function ComboStreak({ question, runtime, report, done, revealed }: ModeProps<Q>) {
  const { items, perItem } = question;
  const [i, setI] = useState(0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const finished = useRef(false);

  const onAnswer = useCallback(
    (key: string | null, frac: number) => {
      const it = items[i];
      const ok = key === it.target.id;
      report({
        vocabId: it.target.id,
        result: key === null ? 'unsure' : ok ? 'correct' : 'wrong',
        given: ok || key === null ? undefined : it.options.find((o) => o.key === key)?.label,
        timeLeft: runtime.timersEnabled ? frac : undefined,
      });
      const c = ok ? combo + 1 : 0;
      setCombo(c);
      setBest((b) => Math.max(b, c));
      setTimeout(() => {
        if (i + 1 >= items.length) {
          if (!finished.current) {
            finished.current = true;
            done();
          }
        } else setI(i + 1);
      }, runtime.reduceMotion ? 400 : 700);
    },
    [items, i, combo, report, done, runtime.timersEnabled, runtime.reduceMotion],
  );

  useEffect(() => {
    if (revealed) finished.current = true;
  }, [revealed]);

  const heat = Math.min(10, combo);
  return (
    <div className="mode combo-streak">
      <Instruction>Answer fast in both directions. Each correct answer raises your multiplier; a miss just resets it.</Instruction>
      <div className="combo-meter" aria-label={`Combo ${combo}, multiplier ${comboMultiplier(combo).toFixed(1)}×`}>
        <span className="combo-flame" style={{ fontSize: `${1.4 + heat * 0.12}rem` }} aria-hidden="true">🔥</span>
        <span className="combo-count">×{comboMultiplier(combo).toFixed(1)}</span>
        <span className="muted small">streak {combo} · best {best} · {Math.min(i + 1, items.length)}/{items.length}</span>
      </div>
      {!revealed ? (
        <Step key={i} item={items[i]} timed={runtime.timersEnabled} perItem={perItem} onAnswer={onAnswer} />
      ) : (
        <p className="center explain">🏁 Best streak: {best}</p>
      )}
    </div>
  );
}

export const comboStreak: ModeDef<Q> = {
  id: 'combo-streak',
  name: 'Combo Streak',
  icon: '🔥',
  skill: 'arcade',
  weight: 'recognition',
  blurb: 'Rapid-fire questions in both directions — build the longest streak.',
  targetsPerQuestion: 8,
  minTargets: 4,
  timed: true,
  isEligible: () => true,
  build: (targets, { all, rng }) => {
    if (targets.length < 4) return null;
    const items: Item[] = [];
    targets.forEach((t, k) => {
      const dir = k % 2 === 0 ? 'en-vi' : 'vi-en';
      const ds = pickDistractors(t, all, 2, rng, { samePos: true });
      items.push({
        target: t,
        dir,
        options: shuffle([t, ...ds], rng).map((e) => ({ key: e.id, label: dir === 'en-vi' ? meaningText(e) : e.word })),
      });
    });
    if (items.some((it) => it.options.length < 3)) return null;
    return { items, perItem: 8 };
  },
  Component: ComboStreak,
};
