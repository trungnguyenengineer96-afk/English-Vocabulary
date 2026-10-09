import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initialScore, scoreAnswer, sessionXp, type ScoreState } from '../core/scoring';
import { categorize, type ReviewCategory } from '../core/selection';
import type { SessionSummary } from '../core/types';
import { VOCAB } from '../data/words';
import { MODE_BY_ID, SKILL_LABEL } from '../modes/registry';
import type { GradedResult, ModeRuntime } from '../modes/types';
import { useStore } from '../state/store';
import { useAudio } from '../ui/audio';
import { FeedbackPanel } from './FeedbackPanel';
import type { SessionPlan } from './planner';
import { ResultsView, type SessionOutcome } from './ResultsView';

interface Props {
  plan: SessionPlan;
  onExit: () => void;
  onReplay?: (ids: string[]) => void;
}

export function SessionPlayer({ plan, onExit, onReplay }: Props) {
  const store = useStore();
  const audio = useAudio();
  const { settings } = store.data;
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<Record<string, GradedResult>>({});
  const [gains, setGains] = useState<Record<string, number>>({});
  const [score, setScore] = useState<ScoreState>(initialScore);
  const [outcome, setOutcome] = useState<SessionOutcome | null>(null);
  const [pop, setPop] = useState<{ id: number; ok: boolean } | null>(null);
  const startedAt = useRef(store.now());
  const scoreRef = useRef(score);
  scoreRef.current = score;
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const nextRef = useRef<HTMLButtonElement>(null);

  // Snapshot of each target's review category before this session changed anything.
  const startCategory = useMemo(() => {
    const out: Record<string, ReviewCategory | 'unsaved'> = {};
    for (const id of plan.targetIds) {
      const item = store.data.library[id];
      out[id] = item ? categorize(item, startedAt.current) : 'unsaved';
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const q = plan.questions[index];
  const mode = q ? MODE_BY_ID.get(q.modeId) : undefined;

  const runtime: ModeRuntime = useMemo(
    () => ({
      speak: audio.speak,
      audioAvailable: audio.available,
      timersEnabled: !settings.practiceMode,
      reduceMotion: settings.reduceMotion,
      onAchievement: store.unlockAchievement,
    }),
    [audio.speak, audio.available, settings.practiceMode, settings.reduceMotion, store.unlockAchievement],
  );

  const report = useCallback(
    (r: GradedResult) => {
      if (!q || !mode || !q.targetIds.includes(r.vocabId) || resultsRef.current[r.vocabId]) return;
      store.answer(r.vocabId, { result: r.result, mode: mode.id, skill: mode.skill, given: r.given, sessionId: plan.id });
      const { state, gained } = scoreAnswer(scoreRef.current, {
        result: r.result,
        weight: mode.weight,
        hintUsed: r.hintUsed,
        timeLeft: r.timeLeft,
      });
      scoreRef.current = state;
      resultsRef.current = { ...resultsRef.current, [r.vocabId]: r };
      setScore(state);
      setResults(resultsRef.current);
      setGains((g) => ({ ...g, [r.vocabId]: gained }));
      setPop({ id: Date.now(), ok: r.result === 'correct' });
    },
    [q, mode, store, plan.id],
  );

  const done = useCallback(() => setRevealed(true), []);

  const dontKnow = () => {
    if (!q) return;
    for (const id of q.targetIds) if (!resultsRef.current[id]) report({ vocabId: id, result: 'unsure' });
    setRevealed(true);
  };

  const finish = useCallback(() => {
    const res = resultsRef.current;
    const graded = Object.values(res);
    const correct = graded.filter((r) => r.result === 'correct').length;
    const total = plan.targetIds.length;
    const completed = graded.length === total && total > 0;
    const s = scoreRef.current;
    const summary: SessionSummary = {
      id: plan.id,
      kind: plan.kind,
      modeId: plan.modeId,
      startedAt: startedAt.current,
      finishedAt: store.now(),
      total,
      answered: graded.length,
      correct,
      graded: graded.length,
      points: s.points,
      xp: sessionXp(s.points, completed),
      wrongIds: graded.filter((r) => r.result !== 'correct').map((r) => r.vocabId),
    };
    store.finishSession(summary);
    setOutcome({ summary, results: res, startCategory, bestCombo: s.bestCombo, completed });
  }, [plan, store, startCategory]);

  const next = () => {
    if (index + 1 >= plan.questions.length) finish();
    else {
      setIndex(index + 1);
      setRevealed(false);
    }
  };

  useEffect(() => {
    if (revealed) nextRef.current?.focus();
  }, [revealed]);

  useEffect(() => {
    if (!revealed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (outcome) {
    return <ResultsView outcome={outcome} onExit={onExit} onReplay={onReplay} />;
  }

  if (!q || !mode) {
    return (
      <div className="card empty-state">
        <p>There are no questions in this session.</p>
        {plan.dropped.length > 0 && <p className="muted">The selected words lack the data this mode needs.</p>}
        <button className="btn primary" onClick={onExit}>Back</button>
      </div>
    );
  }

  const answered = Object.keys(results).length;
  const total = plan.targetIds.length;
  const graded = answered;
  const correct = Object.values(results).filter((r) => r.result === 'correct').length;
  const round = plan.rounds[q.round];
  const Comp = mode.Component;
  const qResults = q.targetIds.map((id) => ({ id, r: results[id], gained: gains[id] ?? 0 }));
  const motion = !settings.reduceMotion;

  return (
    <div className={`session skill-${mode.skill}`}>
      <header className="session-head">
        <button type="button" className="btn ghost small" onClick={() => (answered > 0 ? finish() : onExit())}>
          ✕ <span className="hide-sm">{answered > 0 ? 'End & see results' : 'Leave'}</span>
        </button>
        <div className="session-progress" aria-label={`Session completion: ${answered} of ${total} answered`}>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${(answered / Math.max(1, total)) * 100}%` }} />
          </div>
          <span className="muted small">
            {answered}/{total} answered
          </span>
        </div>
        <div className="session-stats">
          <span className="stat-chip" title="Session accuracy (correct ÷ graded)">
            🎯 {graded ? Math.round((correct / graded) * 100) : 0}%
          </span>
          <span className={`stat-chip combo ${score.combo >= 3 ? 'hot' : ''}`} title="Combo streak">
            🔥 ×{score.combo}
          </span>
          <span className="stat-chip" title="Points this session">⭐ {score.points}</span>
        </div>
      </header>
      {plan.rounds.length > 1 && round && (
        <p className="round-banner">
          Round {q.round + 1}/{plan.rounds.length}: {round.title}
          {round.skill ? ` · ${SKILL_LABEL[round.skill].icon} ${SKILL_LABEL[round.skill].name}` : ''}
        </p>
      )}
      <section className="card mode-card" aria-labelledby="mode-title">
        <div className="mode-title-row">
          <h2 id="mode-title">
            <span aria-hidden="true">{mode.icon}</span> {mode.name}
          </h2>
          <span className={`skill-badge ${mode.skill}`}>{SKILL_LABEL[mode.skill].name}</span>
        </div>
        <Comp key={q.key} question={q.question} runtime={runtime} report={report} done={done} revealed={revealed} />
        {!revealed && (
          <div className="mode-actions">
            <button type="button" className="btn ghost" onClick={dontKnow}>
              🤷 I don't know
            </button>
          </div>
        )}
        {pop && motion && <span key={pop.id} className={`pop ${pop.ok ? 'ok' : 'no'}`} aria-hidden="true">{pop.ok ? '+' : '·'}</span>}
      </section>
      <div aria-live="polite" className="sr-only">
        {revealed && qResults.map(({ id, r }) => `${VOCAB.get(id)?.word}: ${r ? (r.result === 'correct' ? 'correct' : r.result === 'unsure' ? 'not sure' : 'incorrect') : 'not graded'}.`).join(' ')}
      </div>
      {revealed && (
        <FeedbackPanel items={qResults} runtime={runtime}>
          <button ref={nextRef} type="button" className="btn primary big" onClick={next}>
            {index + 1 >= plan.questions.length ? 'See results' : 'Next'} <kbd>Enter</kbd>
          </button>
        </FeedbackPanel>
      )}
    </div>
  );
}
