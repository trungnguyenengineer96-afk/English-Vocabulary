import { buildPath, CONQUER_LEARNED, CONQUER_MASTERED, type Stage, type StageStatus } from '../../core/path';
import { CEFR_INFO } from '../../core/placement';
import { WORDS } from '../../data/words';
import { reviewPlan } from '../../session/launch';
import { useStore } from '../../state/store';
import { useAudio } from '../audio';
import { relativeDayVi } from '../format';
import { useNav } from '../nav';
import { useProfile } from '../profiles/ProfileContext';
import { playSfx } from '../sfx';

const STATUS: Record<StageStatus, { icon: string; label: string }> = {
  conquered: { icon: '🏁', label: 'Đã chinh phục' },
  foundation: { icon: '🧱', label: 'Nền tảng — ôn lại khi cần' },
  current: { icon: '🧭', label: 'Bạn đang ở đây' },
  next: { icon: '🔜', label: 'Chặng tiếp theo' },
  ahead: { icon: '⛰️', label: 'Phía trước' },
};

export const CHECKPOINT_MIN = 4;
export const CHECKPOINT_SIZE = 12;

export function Path() {
  const { data, now } = useStore();
  const { go, startSession } = useNav();
  const audio = useAudio();
  const profile = useProfile();
  const stages = buildPath(data, WORDS);
  const current = stages.find((s) => s.status === 'current');
  const p = data.placement;
  const t = now();

  const checkpoint = (s: Stage) => {
    const ids = WORDS.filter((w) => w.difficulty === s.difficulty && data.library[w.id]).map((w) => w.id);
    playSfx('next');
    startSession(
      reviewPlan({ data, now: t, audioAvailable: audio.available }, { only: ids, size: Math.min(CHECKPOINT_SIZE, ids.length) }),
    );
  };

  return (
    <div className="path" lang="vi">
      <section className="card path-head">
        <div>
          <h1>🗺️ Lộ trình {profile ? `của ${profile.profile.name}` : 'học'}</h1>
          {p ? (
            <p>
              Trình độ đầu vào: <strong>{p.cefr} · {CEFR_INFO[p.cefr].vi}</strong>{' '}
              <span className="muted small">(kiểm tra {relativeDayVi(p.takenAt, t)})</span>
            </p>
          ) : (
            <p className="muted">Chưa làm bài kiểm tra đầu vào: lộ trình đang dựa trên trình độ bạn tự chọn.</p>
          )}
          {current && (
            <p className="path-goal">
              🎯 Mục tiêu chặng <strong>{current.cefr}</strong>:
              {current.toLearn > 0 ? ` học thêm ${current.toLearn} từ` : ''}
              {current.toLearn > 0 && current.toMaster > 0 ? ' và' : ''}
              {current.toMaster > 0 ? ` thuộc thêm ${current.toMaster} từ` : ''}
              {current.toLearn === 0 && current.toMaster === 0 ? ' đã đạt!' : '.'}
            </p>
          )}
        </div>
        <div className="row">
          <button type="button" className="btn primary" onClick={() => go('learn')}>🌱 Học từ mới</button>
          <button type="button" className="btn" onClick={() => go('placement')}>{p ? '🔁 Làm lại bài kiểm tra' : '🎯 Làm bài kiểm tra đầu vào'}</button>
        </div>
      </section>

      <ol className="path-map" aria-label="Các chặng học">
        {[...stages].reverse().map((s) => {
          const info = CEFR_INFO[s.cefr];
          const learnedPct = s.total ? Math.round((s.learned / s.total) * 100) : 0;
          const masteredPct = s.total ? Math.round((s.mastered / s.total) * 100) : 0;
          const inLib = s.learned;
          return (
            <li key={s.cefr} className={`stage ${s.status}`}>
              <div className="stage-node" aria-hidden="true">{s.status === 'current' ? '🧭' : info.icon}</div>
              <div className="stage-body card">
                <div className="stage-title-row">
                  <h2>Chặng {s.difficulty} · {s.cefr} {info.vi}</h2>
                  <span className={`stage-status ${s.status}`}>{STATUS[s.status].icon} {STATUS[s.status].label}</span>
                </div>
                <div className="stage-bars">
                  <span className="sb-name">Đã học</span>
                  <span className="sb-bar"><span style={{ width: `${learnedPct}%` }} /><i style={{ left: `${CONQUER_LEARNED * 100}%` }} /></span>
                  <span className="sb-val">{s.learned}/{s.total}</span>
                  <span className="sb-name">Đã thuộc</span>
                  <span className="sb-bar mastered"><span style={{ width: `${masteredPct}%` }} /><i style={{ left: `${CONQUER_MASTERED * 100}%` }} /></span>
                  <span className="sb-val">{s.mastered}/{s.total}</span>
                </div>
                <button type="button" className="btn small" disabled={inLib < CHECKPOINT_MIN} onClick={() => checkpoint(s)}>
                  🏆 Kiểm tra chặng {s.cefr}
                </button>
                {inLib < CHECKPOINT_MIN && <span className="muted small"> Cần học ít nhất {CHECKPOINT_MIN} từ của chặng này.</span>}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="muted small center">
        Chinh phục một chặng khi đã học ≥{CONQUER_LEARNED * 100}% số từ và thuộc ≥{CONQUER_MASTERED * 100}% (thuộc = trả lời đúng qua nhiều ngày ôn cách quãng).
      </p>
    </div>
  );
}
