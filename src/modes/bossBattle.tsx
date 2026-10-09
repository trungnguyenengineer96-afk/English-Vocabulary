import { useRef, useState } from 'react';
import { pick } from '../core/rng';
import type { VocabEntry } from '../core/types';
import { ChallengeView, buildChallenge, type Challenge, type ChallengeKind } from './challenges';
import { Instruction } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  challenges: Challenge[];
  boss: { name: string; emoji: string; hp: number };
}

export const HEARTS = 3;
const BOSSES = [
  { name: 'The Grammar Golem', emoji: '🗿' },
  { name: 'Lexicon Dragon', emoji: '🐉' },
  { name: 'Captain Confusable', emoji: '🦑' },
  { name: 'The Forgetful Ghost', emoji: '👻' },
];

/** Boss HP: one miss can be absorbed (n − 1 hits needed, minimum 2). */
export const bossHp = (n: number) => Math.max(2, n - 1);

function BossBattle({ question, runtime, report, done, revealed }: ModeProps<Q>) {
  const { challenges, boss } = question;
  const [i, setI] = useState(0);
  const [hp, setHp] = useState(boss.hp);
  const [hearts, setHearts] = useState(HEARTS);
  const [log, setLog] = useState<string | null>(null);
  const [over, setOver] = useState<'victory' | 'defeat' | 'survived' | null>(null);
  const [waiting, setWaiting] = useState(false);
  const finished = useRef(false);

  const end = (o: 'victory' | 'defeat' | 'survived') => {
    if (finished.current) return;
    finished.current = true;
    setOver(o);
    if (o === 'victory') runtime.onAchievement?.('boss-slayer');
    done();
  };

  const onResult = (ok: boolean, given?: string) => {
    const c = challenges[i];
    report({ vocabId: c.target.id, result: ok ? 'correct' : 'wrong', given });
    const nhp = ok ? Math.max(0, hp - 1) : hp;
    const nh = ok ? hearts : hearts - 1;
    setHp(nhp);
    setHearts(nh);
    setLog(ok ? `💥 Hit! ${boss.name} takes damage.` : `🛡️ ${boss.name} strikes back — you lose a heart.`);
    setWaiting(true);
  };

  const advance = () => {
    setWaiting(false);
    setLog(null);
    if (hearts <= 0) return end('defeat');
    if (i + 1 >= challenges.length) return end(hp <= 0 ? 'victory' : 'survived');
    setI(i + 1);
  };

  const pct = (hp / boss.hp) * 100;
  return (
    <div className="mode boss-battle">
      <Instruction>Optional boss fight: each correct answer hits the boss; each miss costs a heart. Running out of hearts just ends the fight.</Instruction>
      <div className="boss-arena">
        <div className={`boss ${hp === 0 ? 'defeated' : ''}`}>
          <span className="boss-emoji" aria-hidden="true">{boss.emoji}</span>
          <span className="boss-name">{boss.name}</span>
          <div className="hp-bar" role="meter" aria-label="Boss health" aria-valuemin={0} aria-valuemax={boss.hp} aria-valuenow={hp}>
            <div className="hp-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="muted small">HP {hp}/{boss.hp}</span>
        </div>
        <div className="hearts" role="img" aria-label={`${hearts} of ${HEARTS} hearts left`}>
          {Array.from({ length: HEARTS }, (_, k) => (
            <span key={k} aria-hidden="true">{k < hearts ? '❤️' : '🖤'}</span>
          ))}
        </div>
      </div>
      {over || revealed ? (
        <p className="center explain big">
          {over === 'victory' ? `🏆 Victory! ${boss.name} is defeated.` : over === 'defeat' ? `😵 Out of hearts — retreat and train! Unanswered words were not counted against you.` : over === 'survived' ? `🌫️ ${boss.name} escaped with ${hp} HP. So close!` : 'Battle over.'}
        </p>
      ) : (
        <>
          <p className="muted small center">Attack {i + 1}/{challenges.length}</p>
          <ChallengeView key={i} c={challenges[i]} onResult={onResult} />
          {log && <p className="battle-log" role="status">{log}</p>}
          {waiting && (
            <button type="button" className="btn primary center-self" onClick={advance} autoFocus>
              {hearts <= 0 ? 'Retreat' : i + 1 >= challenges.length ? 'Finish' : 'Next attack ⚔️'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export const bossBattle: ModeDef<Q> = {
  id: 'boss-battle',
  name: 'Boss Battle',
  icon: '🐉',
  skill: 'arcade',
  weight: 'production',
  blurb: 'An optional boss fight mixing meaning, context and spelling attacks.',
  targetsPerQuestion: 5,
  minTargets: 3,
  isEligible: () => true,
  build: (targets: VocabEntry[], { all, rng }) => {
    if (targets.length < 3) return null;
    const kinds: ChallengeKind[] = ['meaning', 'context', 'spell'];
    const challenges: Challenge[] = [];
    targets.forEach((t, k) => {
      const preferred = kinds[k % 3];
      const c =
        buildChallenge(preferred, t, all, rng) ?? buildChallenge('meaning', t, all, rng) ?? buildChallenge('spell', t, all, rng);
      if (c) challenges.push(c);
    });
    if (challenges.length !== targets.length) return null;
    return { challenges, boss: { ...pick(BOSSES, rng), hp: bossHp(targets.length) } };
  },
  Component: BossBattle,
};
