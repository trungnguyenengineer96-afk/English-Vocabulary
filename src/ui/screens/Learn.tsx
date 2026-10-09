import { useEffect, useState } from 'react';
import { DAILY_GOALS } from '../../core/daily';
import { dayKey } from '../../core/dates';
import type { DailyGoal } from '../../core/types';
import { VOCAB } from '../../data/words';
import { dailyCheckPlan } from '../../session/launch';
import { useStore } from '../../state/store';
import { useAudio } from '../audio';
import { WordCard } from '../components/WordCard';
import { useNav } from '../nav';

export function Learn() {
  const store = useStore();
  const { data, now } = store;
  const { startSession, go } = useNav();
  const audio = useAudio();
  useEffect(() => {
    store.ensurePlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.settings.dailyGoal]);
  const plan = data.dailyPlans[dayKey(now())];
  const ids = plan?.vocabIds ?? [];
  const learned = new Set(plan?.learnedIds ?? []);
  const firstUnlearned = ids.findIndex((id) => !learned.has(id));
  const [index, setIndex] = useState(() => Math.max(0, firstUnlearned));
  useEffect(() => {
    if (index >= ids.length && ids.length) setIndex(ids.length - 1);
  }, [ids.length, index]);

  if (!plan) return <p className="card">Preparing today’s words…</p>;

  const allDone = ids.length > 0 && ids.every((id) => learned.has(id));
  const entry = VOCAB.get(ids[index]);
  const isLearned = entry ? learned.has(entry.id) : false;

  const saveAndNext = () => {
    if (!entry) return;
    if (!isLearned) store.learn(entry.id);
    const nextIdx = ids.findIndex((id, i) => i > index && !learned.has(id) && id !== entry.id);
    if (nextIdx >= 0) setIndex(nextIdx);
    else if (index + 1 < ids.length) setIndex(index + 1);
  };

  return (
    <div className="learn">
      <section className="card learn-head">
        <div>
          <h1>🌱 Today’s new words</h1>
          <p className="muted">
            {learned.size}/{plan.vocabIds.length} saved to your library today.
            {plan.vocabIds.length < plan.goal && ' The word bank has fewer new words left than your goal.'}
          </p>
        </div>
        <div className="goal-picker" role="radiogroup" aria-label="Daily new-word goal">
          {DAILY_GOALS.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={data.settings.dailyGoal === g}
              className={`chip ${data.settings.dailyGoal === g ? 'active' : ''}`}
              onClick={() => store.setDailyGoal(g as DailyGoal)}
            >
              {g}
            </button>
          ))}
          <span className="muted small">words/day</span>
        </div>
      </section>

      {ids.length === 0 ? (
        <section className="card empty-state">
          <p>🎉 You have saved every word in the word bank!</p>
          <button className="btn primary" onClick={() => go('play')}>Go play</button>
        </section>
      ) : (
        <>
          <ol className="dots" aria-label="Today's words">
            {ids.map((id, i) => (
              <li key={id}>
                <button
                  type="button"
                  className={`dot-btn ${i === index ? 'current' : ''} ${learned.has(id) ? 'done' : ''}`}
                  onClick={() => setIndex(i)}
                  aria-label={`Word ${i + 1}${learned.has(id) ? ', saved' : ''}`}
                  aria-current={i === index ? 'step' : undefined}
                />
              </li>
            ))}
          </ol>
          {entry && (
            <section className="card learn-card">
              <WordCard entry={entry} />
              <div className="learn-actions">
                <button type="button" className="btn" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>
                  ← Previous
                </button>
                <button type="button" className="btn primary big" onClick={saveAndNext} autoFocus>
                  {isLearned ? (index + 1 < ids.length ? 'Next →' : 'Saved ✓') : 'Got it — save & next'}
                </button>
              </div>
            </section>
          )}
          {allDone && (
            <section className="card done-card">
              <h2>✅ Daily goal complete!</h2>
              <p>All of today’s words are in your library. A quick check now helps them stick.</p>
              <div className="row">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => startSession(dailyCheckPlan({ data, now: now(), audioAvailable: audio.available }, ids))}
                >
                  ⚡ Quick check ({ids.length})
                </button>
                <button type="button" className="btn" onClick={() => go('home')}>Dashboard</button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
