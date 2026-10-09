import { formatPct, sessionAccuracy, sessionCompletion } from '../core/metrics';
import type { ReviewCategory } from '../core/selection';
import type { SessionSummary } from '../core/types';
import { VOCAB } from '../data/words';
import { meaningText } from '../modes/shared';
import type { GradedResult } from '../modes/types';
import { useStore } from '../state/store';
import { ACHIEVEMENTS } from '../core/achievements';
import { formatDue } from '../ui/format';

export interface SessionOutcome {
  summary: SessionSummary;
  results: Record<string, GradedResult>;
  startCategory: Record<string, ReviewCategory | 'unsaved'>;
  bestCombo: number;
  completed: boolean;
}

interface Props {
  outcome: SessionOutcome;
  onExit: () => void;
  onReplay?: (ids: string[]) => void;
}

export function ResultsView({ outcome, onExit, onReplay }: Props) {
  const { data, now } = useStore();
  const { summary, results, startCategory } = outcome;
  const completion = sessionCompletion(summary.answered, summary.total);
  const accuracy = sessionAccuracy(summary.correct, summary.graded);
  const missed = Object.values(results).filter((r) => r.result !== 'correct').map((r) => r.vocabId);
  const newWeak = missed.filter((id) => startCategory[id] !== 'mistakes');
  const stillWeak = missed.filter((id) => startCategory[id] === 'mistakes');
  const fixed = Object.values(results)
    .filter((r) => r.result === 'correct' && startCategory[r.vocabId] === 'mistakes')
    .map((r) => r.vocabId);
  const queue = Object.keys(results)
    .map((id) => data.library[id])
    .filter(Boolean)
    .sort((a, b) => a.dueAt - b.dueAt);
  const unlocked = ACHIEVEMENTS.filter((a) => (data.achievements[a.id] ?? 0) >= summary.startedAt);
  const t = now();

  return (
    <div className="results">
      <section className="card results-hero">
        <h2>{summary.graded === 0 ? 'Session ended' : accuracy.value !== undefined && accuracy.value >= 0.8 ? '🏆 Great work!' : '💪 Session complete'}</h2>
        <div className="metric-row">
          <div className="metric">
            <span className="metric-value">{summary.points}</span>
            <span className="metric-label">Score</span>
          </div>
          <div className="metric">
            <span className="metric-value">{formatPct(accuracy)}</span>
            <span className="metric-label">Session accuracy</span>
            <span className="metric-sub">{summary.correct}/{summary.graded} correct</span>
          </div>
          <div className="metric">
            <span className="metric-value">{formatPct(completion)}</span>
            <span className="metric-label">Completion</span>
            <span className="metric-sub">{summary.answered}/{summary.total} answered</span>
          </div>
          <div className="metric xp">
            <span className="metric-value">+{summary.xp}</span>
            <span className="metric-label">XP</span>
            {outcome.completed && <span className="metric-sub">incl. +20 completion bonus</span>}
          </div>
        </div>
        <p className="muted small">
          Session accuracy measures only this session — long-term mastery is tracked separately in your library.
          {outcome.bestCombo >= 3 && ` Best combo: ×${outcome.bestCombo}.`}
        </p>
        {unlocked.length > 0 && (
          <div className="unlocked">
            {unlocked.map((a) => (
              <span key={a.id} className="achievement-chip">
                <span aria-hidden="true">{a.icon}</span> {a.name} unlocked!
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="results-grid">
        <section className="card">
          <h3>🆕 Newly identified weaknesses</h3>
          {newWeak.length ? (
            <WordList ids={newWeak} />
          ) : (
            <p className="muted">None — no new weak spots found.</p>
          )}
          {stillWeak.length > 0 && (
            <>
              <h4>Still tricky</h4>
              <WordList ids={stillWeak} />
            </>
          )}
          {fixed.length > 0 && (
            <>
              <h4>🔁 Fixed mistakes</h4>
              <WordList ids={fixed} />
            </>
          )}
        </section>
        <section className="card">
          <h3>🗓️ Review queue</h3>
          <ul className="queue">
            {queue.map((item) => (
              <li key={item.vocabId}>
                <span lang="en">{VOCAB.get(item.vocabId)?.word}</span>
                <span className={`state-pill ${item.state}`}>{item.state}</span>
                <span className="muted small">{formatDue(item.dueAt, t)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="results-actions">
        {missed.length > 0 && onReplay && (
          <button type="button" className="btn primary big" onClick={() => onReplay(missed)}>
            🔁 Review missed words now ({missed.length})
          </button>
        )}
        <button type="button" className="btn big" onClick={onExit}>
          🏠 Back to dashboard
        </button>
      </div>
    </div>
  );
}

function WordList({ ids }: { ids: string[] }) {
  return (
    <ul className="word-list">
      {ids.map((id) => {
        const e = VOCAB.get(id);
        return e ? (
          <li key={id}>
            <strong lang="en">{e.word}</strong> — {meaningText(e)}
          </li>
        ) : null;
      })}
    </ul>
  );
}
