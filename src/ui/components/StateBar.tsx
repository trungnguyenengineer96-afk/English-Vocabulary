import type { LearningState } from '../../core/types';

const ORDER: LearningState[] = ['new', 'learning', 'familiar', 'mastered'];
const LABEL: Record<LearningState, string> = { new: 'New', learning: 'Learning', familiar: 'Familiar', mastered: 'Mastered' };

export function StateBar({ counts }: { counts: Record<LearningState, number> }) {
  const total = ORDER.reduce((s, k) => s + counts[k], 0);
  if (!total) return null;
  return (
    <div className="state-bar-wrap">
      <div className="state-bar" role="img" aria-label={ORDER.map((k) => `${LABEL[k]} ${counts[k]}`).join(', ')}>
        {ORDER.map((k) => (counts[k] ? <span key={k} className={`seg ${k}`} style={{ flexGrow: counts[k] }} /> : null))}
      </div>
      <ul className="legend">
        {ORDER.map((k) => (
          <li key={k}>
            <span className={`dot ${k}`} aria-hidden="true" /> {LABEL[k]} <strong>{counts[k]}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
