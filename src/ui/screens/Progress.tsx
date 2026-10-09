import { ACHIEVEMENTS } from '../../core/achievements';
import { dueCount, formatPct, libraryMastery, sessionAccuracy, sessionCompletion, stateCounts } from '../../core/metrics';
import { levelForXp } from '../../core/scoring';
import { MODE_BY_ID } from '../../modes/registry';
import { useStore } from '../../state/store';
import { StateBar } from '../components/StateBar';
import { relativeDay } from '../format';

const KIND = { review: 'Adaptive review', mixed: 'Mixed Challenge', mode: 'Mode', 'daily-check': 'Quick check' } as const;

export function Progress() {
  const { data, now } = useStore();
  const t = now();
  const mastery = libraryMastery(data.library);
  const lvl = levelForXp(data.xp);
  const sessions = data.sessions.slice(-12).reverse();
  return (
    <div className="progress">
      <section className="card">
        <h1>🏅 Progress</h1>
        <div className="metric-row">
          <div className="metric"><span className="metric-value">Lv {lvl.level}</span><span className="metric-label">{data.xp} XP</span></div>
          <div className="metric"><span className="metric-value">{formatPct(mastery)}</span><span className="metric-label">Library mastery</span><span className="metric-sub">{mastery.num}/{mastery.den} mastered</span></div>
          <div className="metric"><span className="metric-value">{dueCount(data.library, t)}</span><span className="metric-label">Due reviews</span></div>
          <div className="metric"><span className="metric-value">{data.activityDays.length}</span><span className="metric-label">Study days</span><span className="metric-sub">no streak pressure</span></div>
        </div>
        <StateBar counts={stateCounts(data.library)} />
      </section>

      <section className="card">
        <h2>Achievements</h2>
        <ul className="achievements">
          {ACHIEVEMENTS.map((a) => {
            const at = data.achievements[a.id];
            return (
              <li key={a.id} className={at ? 'unlocked' : 'locked'}>
                <span className="ach-icon" aria-hidden="true">{at ? a.icon : '🔒'}</span>
                <span className="ach-name">{a.name}</span>
                <span className="ach-desc muted small">{a.description}</span>
                {at ? <span className="sr-only">Unlocked</span> : <span className="sr-only">Locked</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card">
        <h2>Recent sessions</h2>
        {sessions.length === 0 ? (
          <p className="muted">No sessions yet.</p>
        ) : (
          <table className="sessions">
            <thead>
              <tr><th>When</th><th>Type</th><th>Completion</th><th>Accuracy</th><th>XP</th></tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{relativeDay(s.finishedAt, t)}</td>
                  <td>{s.modeId ? MODE_BY_ID.get(s.modeId as never)?.name ?? s.modeId : KIND[s.kind]}</td>
                  <td>{formatPct(sessionCompletion(s.answered, s.total))}</td>
                  <td>{formatPct(sessionAccuracy(s.correct, s.graded))}</td>
                  <td>+{s.xp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
