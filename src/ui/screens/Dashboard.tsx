import { dayKey } from '../../core/dates';
import { dueCount, formatPct, libraryMastery, recentImprovement, sessionAccuracy, sessionCompletion, stateCounts, weakWords } from '../../core/metrics';
import { levelForXp } from '../../core/scoring';
import { VOCAB } from '../../data/words';
import { meaningText } from '../../modes/shared';
import { mixedPlan, reviewPlan } from '../../session/launch';
import { useStore } from '../../state/store';
import { useAudio } from '../audio';
import { useNav } from '../nav';
import { StateBar } from '../components/StateBar';
import { useProfile } from '../profiles/ProfileContext';
import { CEFR_INFO } from '../../core/placement';
import { weakSkill } from '../../core/personalize';
import { todaysQuests, type Quest } from '../../core/quests';
import { MODES, MODE_BY_ID, SKILL_LABEL } from '../../modes/registry';
import { eligibleCount, modePlan } from '../../session/launch';
import type { Skill } from '../../core/types';
import { playSfx } from '../sfx';

export function Dashboard() {
  const { data, now } = useStore();
  const { go, startSession } = useNav();
  const audio = useAudio();
  const t = now();
  const plan = data.dailyPlans[dayKey(t)];
  const goal = data.settings.dailyGoal;
  const learnedToday = plan?.learnedIds.length ?? 0;
  const due = dueCount(data.library, t);
  const saved = Object.keys(data.library).length;
  const mastery = libraryMastery(data.library);
  const last = data.sessions.at(-1);
  const weak = weakWords(data.library, t, 6);
  const imp = recentImprovement(data.library, t);
  const lvl = levelForXp(data.xp);
  const counts = stateCounts(data.library);

  const startReview = () => startSession(reviewPlan({ data, now: t, audioAvailable: audio.available }));
  const profile = useProfile();
  const env = { data, now: t, audioAvailable: audio.available };
  const weakSk = weakSkill(data, t);
  const quests = todaysQuests(data, t, weakSk, (id) => MODE_BY_ID.get(id as never)?.skill);
  const required = quests.filter((q) => !q.optional);
  const doneCount = required.filter((q) => q.done).length;
  /** Least-played mode of the weak skill that has enough suitable words. */
  const skillGame = (skill?: Skill) => {
    const pool = MODES.filter((m) => (!skill || m.skill === skill) && eligibleCount(env, m.id) >= (m.minTargets ?? m.targetsPerQuestion));
    return pool.sort((a, b) => (data.modeStats[a.id]?.played ?? 0) - (data.modeStats[b.id]?.played ?? 0))[0];
  };
  const runQuest = (q: Quest) => {
    playSfx('next');
    if (q.id === 'review') startReview();
    else if (q.id === 'learn') go('learn');
    else if (q.id === 'mixed') startSession(mixedPlan(env, 'mixed'));
    else {
      const m = skillGame(q.skill) ?? skillGame();
      if (m) startSession(modePlan(env, m.id));
      else go('play');
    }
  };
  const questLabel = (q: Quest) =>
    q.id === 'review'
      ? q.done ? 'Không còn từ đến hạn ôn' : `Ôn ${q.count} từ đến hạn`
      : q.id === 'learn'
        ? `Học ${q.count} từ mới`
        : q.id === 'skill'
          ? q.skill ? `Luyện kỹ năng yếu: ${SKILL_LABEL[q.skill].icon} ${SKILL_LABEL[q.skill].vi}` : 'Chơi 1 trò chơi bất kỳ'
          : 'Thử thách tổng hợp (tuỳ chọn)';

  return (
    <div className="dashboard">
      <section className="hero card">
        <div>
          <p className="eyebrow">Xin chào, {profile ? profile.profile.name : 'explorer'}! {profile?.profile.avatar ?? '🧭'}</p>
          <h1>Your vocabulary quest</h1>
          <p className="muted">Learn a few new words, review the ones that need you, then play.</p>
        </div>
        <div className="level-box" aria-label={`Level ${lvl.level}, ${lvl.into} of ${lvl.span} XP to next level`}>
          <span className="level-num">Lv {lvl.level}</span>
          <div className="bar small"><div className="bar-fill xp" style={{ width: `${(lvl.into / lvl.span) * 100}%` }} /></div>
          <span className="muted small">{data.xp} XP total</span>
        </div>
      </section>

      {!data.placement && (
        <section className="card placement-cta" lang="vi">
          <span className="pc-icon" aria-hidden="true">🎯</span>
          <div>
            <h2>Làm bài kiểm tra đầu vào (≈5 phút)</h2>
            <p className="muted">Để app chọn từ vừa sức, đúng chủ đề bạn thích và ưu tiên kỹ năng cần luyện.</p>
          </div>
          <button type="button" className="btn primary" onClick={() => go('placement')}>Bắt đầu kiểm tra</button>
        </section>
      )}

      <section className="card quests" lang="vi" aria-labelledby="quests-h">
        <div className="quests-head">
          <h2 id="quests-h">⚔️ Nhiệm vụ hôm nay</h2>
          <span className={`quest-count ${doneCount === required.length ? 'all' : ''}`}>
            {doneCount === required.length ? '🎉 Hoàn thành!' : `${doneCount}/${required.length}`}
          </span>
          {data.placement && (
            <button type="button" className="btn ghost small" onClick={() => go('path')}>
              🗺️ {data.placement.cefr} · {CEFR_INFO[data.placement.cefr].vi}
            </button>
          )}
        </div>
        <ul className="quest-list">
          {quests.map((q) => (
            <li key={q.id} className={`quest ${q.done ? 'done' : ''} ${q.optional ? 'optional' : ''}`}>
              <span className="quest-check" aria-hidden="true">{q.done ? '✅' : q.optional ? '⭐' : '⬜'}</span>
              <span className="quest-label">{questLabel(q)}</span>
              {!q.done && (
                <button type="button" className="btn small" onClick={() => runQuest(q)}
                  disabled={(q.id !== 'learn' && saved === 0) || (q.id === 'mixed' && saved < 4)}>
                  Làm ngay
                </button>
              )}
              <span className="sr-only">{q.done ? 'đã xong' : 'chưa xong'}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="action-grid">
        <section className="card action-card learn">
          <h2><span aria-hidden="true">🌱</span> New words today</h2>
          <p className="big-number" aria-label={`${learnedToday} of ${goal} new words learned today`}>
            {learnedToday}<span className="of">/{goal}</span>
          </p>
          <p className="muted small">Daily goal for <em>new</em> words. Reviews are counted separately.</p>
          <button type="button" className="btn primary" onClick={() => go('learn')}>
            {learnedToday >= goal ? 'See today’s words' : learnedToday ? 'Continue learning' : 'Start learning'}
          </button>
        </section>
        <section className="card action-card review">
          <h2><span aria-hidden="true">🔁</span> Due for review</h2>
          <p className="big-number" aria-label={`${due} words due for review`}>{due}</p>
          <p className="muted small">Words whose spaced-review date has arrived, plus recent mistakes.</p>
          <button type="button" className="btn primary" onClick={startReview} disabled={saved === 0}>
            Start adaptive review
          </button>
        </section>
        <section className="card action-card play">
          <h2><span aria-hidden="true">🎮</span> Game modes</h2>
          <p className="muted">Mixed Challenge, an optional Boss Battle and 30 mini-games.</p>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => startSession(mixedPlan({ data, now: t, audioAvailable: audio.available }, 'mixed'))} disabled={saved < 4}>
              🎪 Mixed Challenge
            </button>
            <button type="button" className="btn" onClick={() => go('play')} disabled={saved === 0}>
              Game hub
            </button>
          </div>
          {saved === 0 && <p className="muted small">Learn some words first to unlock games.</p>}
        </section>
      </div>

      <section className="card" aria-labelledby="metrics-h">
        <h2 id="metrics-h">Progress at a glance</h2>
        <div className="metric-row three">
          <div className="metric">
            <span className="metric-value">{last ? formatPct(sessionCompletion(last.answered, last.total)) : '—'}</span>
            <span className="metric-label">Session completion</span>
            <span className="metric-sub">{last ? `${last.answered}/${last.total} answered (last session)` : 'No sessions yet'}</span>
          </div>
          <div className="metric">
            <span className="metric-value">{last ? formatPct(sessionAccuracy(last.correct, last.graded)) : '—'}</span>
            <span className="metric-label">Session accuracy</span>
            <span className="metric-sub">{last ? `${last.correct}/${last.graded} correct (last session)` : 'Correct ÷ graded answers'}</span>
          </div>
          <div className="metric">
            <span className="metric-value">{formatPct(mastery)}</span>
            <span className="metric-label">Library mastery</span>
            <span className="metric-sub">{mastery.num}/{mastery.den} saved words mastered</span>
          </div>
        </div>
        {saved > 0 && <StateBar counts={counts} />}
      </section>

      <div className="two-col">
        <section className="card">
          <h2>🩹 Weak words</h2>
          {weak.length ? (
            <ul className="word-list">
              {weak.map((i) => {
                const e = VOCAB.get(i.vocabId);
                return e ? (
                  <li key={i.vocabId}>
                    <strong lang="en">{e.word}</strong> — {meaningText(e)}
                    <span className="muted small"> · {i.wrongCount + i.unsureCount} miss{i.wrongCount + i.unsureCount === 1 ? '' : 'es'}</span>
                  </li>
                ) : null;
              })}
            </ul>
          ) : (
            <p className="muted">No weak words right now. 🎉</p>
          )}
          {weak.length > 0 && (
            <button
              type="button"
              className="btn small"
              onClick={() => startSession(reviewPlan({ data, now: t, audioAvailable: audio.available }, { only: weak.map((w) => w.vocabId) }))}
            >
              Practise these
            </button>
          )}
        </section>
        <section className="card">
          <h2>📈 Recent improvement</h2>
          {imp.recent.den === 0 ? (
            <p className="muted">Answer some questions to see your trend.</p>
          ) : (
            <>
              <p>
                Answer accuracy, last 7 days: <strong>{formatPct(imp.recent)}</strong>{' '}
                <span className="muted small">({imp.recent.num}/{imp.recent.den})</span>
              </p>
              <p>
                Previous 7 days: <strong>{formatPct(imp.previous)}</strong>{' '}
                {imp.previous.den > 0 && <span className="muted small">({imp.previous.num}/{imp.previous.den})</span>}
              </p>
              {imp.delta !== undefined && (
                <p className={imp.delta >= 0 ? 'trend up' : 'trend down'}>
                  {imp.delta >= 0 ? '▲' : '▼'} {Math.abs(imp.delta)} percentage points
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
