import { useState } from 'react';
import type { Skill } from '../../core/types';
import { MODES, SKILL_LABEL } from '../../modes/registry';
import type { AnyModeDef } from '../../modes/types';
import { MIXED_SIZE, eligibleCount, mixedPlan, modePlan } from '../../session/launch';
import type { MixedFocus } from '../../session/planner';
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
  const [focus, setFocus] = useState<MixedFocus>('mixed');
  const focusOptions: { id: MixedFocus; label: string; disabled?: boolean }[] = [
    { id: 'mixed', label: '🎪 Mixed' },
    { id: 'reading', label: '📖 Reading' },
    { id: 'listening', label: '🎧 Listening', disabled: !audio.available },
    { id: 'writing', label: '✏️ Writing' },
  ];

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
          <p className="notice">🔇 Audio is unavailable, so listening modes are turned off.</p>
        )}
      </section>
      <section className="card mixed-card" aria-labelledby="mixed-h">
        <div>
          <h2 id="mixed-h">🎪 Mixed Challenge</h2>
          <p className="muted">
            {Math.min(MIXED_SIZE, saved)} different words from your library · 4 rounds of 5 · reading, listening, writing and arcade mechanics.
            Ends with a review queue of what to practise next.
          </p>
          <div className="chip-row" role="radiogroup" aria-label="Challenge focus">
            {focusOptions.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={focus === f.id} disabled={f.disabled}
                className={`chip ${focus === f.id ? 'active' : ''}`} onClick={() => setFocus(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          {saved > 0 && saved < 8 && <p className="muted small">Tip: with fewer than 8 saved words the challenge will be short.</p>}
        </div>
        <button type="button" className="btn primary big" disabled={saved < 4} onClick={() => startSession(mixedPlan(env, focus))}>
          Start challenge ⚔️
        </button>
      </section>
      {SKILLS.map((skill) => {
        const modes = MODES.filter((m) => m.skill === skill && (data.settings.showBoss || m.id !== 'boss-battle'));
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
