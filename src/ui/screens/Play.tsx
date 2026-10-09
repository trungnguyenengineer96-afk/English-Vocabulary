import type { Skill } from '../../core/types';
import { MODES, SKILL_LABEL } from '../../modes/registry';
import type { AnyModeDef } from '../../modes/types';
import { eligibleCount, modePlan } from '../../session/launch';
import { useStore } from '../../state/store';
import { useAudio } from '../audio';
import { useNav } from '../nav';

const SKILLS: Skill[] = ['reading', 'listening', 'writing', 'arcade'];

export function Play() {
  const { data, now, updateSettings } = useStore();
  const audio = useAudio();
  const { startSession } = useNav();
  const env = { data, now: now(), audioAvailable: audio.available };
  const saved = Object.keys(data.library).length;

  const launch = (m: AnyModeDef) => startSession(modePlan(env, m.id));

  return (
    <div className="play">
      <section className="card play-head">
        <h1>🎮 Game hub</h1>
        <p className="muted">Every mode uses words from your library and updates your review schedule.</p>
        <label className="toggle">
          <input type="checkbox" checked={data.settings.practiceMode} onChange={(e) => updateSettings({ practiceMode: e.target.checked })} />
          <span>Practice mode (no timers)</span>
        </label>
        {!audio.available && audio.checked && (
          <p className="notice">🔇 No English speech voice is available in this browser, so listening modes are turned off.</p>
        )}
      </section>
      {SKILLS.map((skill) => {
        const modes = MODES.filter((m) => m.skill === skill);
        if (!modes.length) return null;
        return (
          <section key={skill} className={`skill-section ${skill}`} aria-labelledby={`skill-${skill}`}>
            <h2 id={`skill-${skill}`}>
              <span aria-hidden="true">{SKILL_LABEL[skill].icon}</span> {SKILL_LABEL[skill].name}{' '}
              <span className="muted small">{SKILL_LABEL[skill].vi}</span>
            </h2>
            <div className="mode-grid">
              {modes.map((m) => {
                const n = eligibleCount(env, m.id);
                const need = m.minTargets ?? m.targetsPerQuestion;
                const blocked = (m.requiresAudio && !audio.available) || n < Math.max(1, need);
                return (
                  <button key={m.id} type="button" className={`mode-tile ${skill}`} onClick={() => launch(m)} disabled={blocked}>
                    <span className="tile-icon" aria-hidden="true">{m.icon}</span>
                    <span className="tile-name">{m.name}</span>
                    <span className="tile-blurb">{m.blurb}</span>
                    <span className="tile-meta">
                      {m.requiresAudio && !audio.available
                        ? 'Needs speech audio'
                        : n < need
                          ? saved === 0 ? 'Learn words first' : `Needs ${need}+ suitable words`
                          : `${n} word${n === 1 ? '' : 's'} ready`}
                      {m.timed && !data.settings.practiceMode ? ' · ⏱ timed' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
