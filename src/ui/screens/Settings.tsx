import { useRef, useState } from 'react';
import { DAILY_GOALS } from '../../core/daily';
import { apportion, DEFAULT_WEIGHTS } from '../../core/selection';
import { exportData, parseImport } from '../../core/storage';
import type { DailyGoal, LearnerLevel, ReviewWeights } from '../../core/types';
import { useStore } from '../../state/store';
import { useAudio } from '../audio';
import { TEST_PHRASE } from '../speechKey';
import { playSfx } from '../sfx';

const WEIGHT_LABEL: Record<keyof ReviewWeights, string> = {
  mistakes: 'Mistakes & unsure', due: 'Due reviews', weak: 'Weak words', reinforcement: 'Reinforcement / random',
};

export function Settings() {
  const store = useStore();
  const { settings } = store.data;
  const audio = useAudio();
  const [msg, setMsg] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const preview = apportion(settings.testSize, settings.weights);

  const doExport = () => {
    const blob = new Blob([exportData(store.data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vocab-quest-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const doImport = async (f: File) => {
    const r = parseImport(await f.text(), store.now());
    if (r.error || !r.data) return setMsg(`Import failed: ${r.error}`);
    if (!confirm(`Replace current progress with ${Object.keys(r.data.library).length} words from this file?`)) return;
    store.replaceData(r.data);
    setMsg('Progress imported.');
  };

  return (
    <div className="settings">
      <section className="card">
        <h1>⚙️ Settings</h1>
        {store.readOnly && <p className="notice">Progress is read-only in this session (see the notice at the top), so changes will not be saved.</p>}
        <fieldset>
          <legend>Daily new words</legend>
          <div className="chip-row" role="radiogroup" aria-label="Daily new-word goal">
            {DAILY_GOALS.map((g) => (
              <button key={g} type="button" role="radio" aria-checked={settings.dailyGoal === g}
                className={`chip ${settings.dailyGoal === g ? 'active' : ''}`} onClick={() => store.setDailyGoal(g as DailyGoal)}>
                {g}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="field">
          Level
          <select value={settings.level} onChange={(e) => store.updateSettings({ level: e.target.value as LearnerLevel })}>
            <option value="beginner">Beginner (mostly A1–A2)</option>
            <option value="intermediate">Intermediate (mostly A2–B2)</option>
            <option value="advanced">Advanced (mostly B1–C1)</option>
          </select>
          <span className="muted small">Applies to new daily plans; today’s plan is kept.</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.practiceMode} onChange={(e) => store.updateSettings({ practiceMode: e.target.checked })} />
          <span>Practice mode — turn off all timers</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.reduceMotion} onChange={(e) => store.updateSettings({ reduceMotion: e.target.checked })} />
          <span>Reduce motion</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.showBoss} onChange={(e) => store.updateSettings({ showBoss: e.target.checked })} />
          <span>Offer optional boss challenges</span>
        </label>
      </section>

      <section className="card">
        <h2>Review tests</h2>
        <label className="field">
          Words per test: <strong>{settings.testSize}</strong>
          <input type="range" min={5} max={50} step={5} value={settings.testSize}
            onChange={(e) => store.updateSettings({ testSize: Number(e.target.value) })} />
        </label>
        <fieldset>
          <legend>Selection weights (tunable)</legend>
          {(Object.keys(WEIGHT_LABEL) as (keyof ReviewWeights)[]).map((k) => (
            <label key={k} className="weight-row">
              <span>{WEIGHT_LABEL[k]}</span>
              <input type="number" min={0} max={100} value={settings.weights[k]}
                onChange={(e) => store.updateSettings({ weights: { ...settings.weights, [k]: Math.max(0, Number(e.target.value) || 0) } })} />
              <span className="muted small">≈ {preview[k]} of {settings.testSize}</span>
            </label>
          ))}
          <button type="button" className="btn small ghost" onClick={() => store.updateSettings({ weights: { ...DEFAULT_WEIGHTS } })}>
            Reset to 40/30/20/10
          </button>
          <p className="muted small">When a category has too few words, the remaining slots are filled from other categories.</p>
        </fieldset>
      </section>

      <section className="card">
        <h2>Audio</h2>
        <p className="muted">
          {audio.source === 'clips' || audio.source === 'clips+voice'
            ? '🔊 Built-in pronunciation audio (works offline, no system voice needed).'
            : audio.source === 'voice'
              ? '🔊 Using the system’s English speech voice.'
              : audio.checked
                ? '🔇 No audio available — listening modes are disabled.'
                : 'Checking audio…'}
        </p>
        <label className="field">
          Playback speed: {settings.speechRate.toFixed(1)}×
          <input type="range" min={0.5} max={1.5} step={0.1} value={settings.speechRate}
            onChange={(e) => store.updateSettings({ speechRate: Number(e.target.value) })} />
        </label>
        <button type="button" className="btn small" disabled={!audio.available} onClick={() => audio.speak(TEST_PHRASE)}>
          ▶ Test sound
        </button>
      </section>

      <section className="card">
        <h2>🎵 Sound effects · Âm thanh hiệu ứng</h2>
        <label className="toggle">
          <input type="checkbox" checked={settings.sfx} onChange={(e) => store.updateSettings({ sfx: e.target.checked })} />
          <span>Play sounds for correct / wrong answers, taps and Next</span>
        </label>
        <label className="field">
          Effects volume: {Math.round(settings.sfxVolume * 100)}%
          <input type="range" min={0} max={1} step={0.1} value={settings.sfxVolume} disabled={!settings.sfx}
            onChange={(e) => store.updateSettings({ sfxVolume: Number(e.target.value) })} />
        </label>
        <div className="row">
          <button type="button" className="btn small" disabled={!settings.sfx} onClick={() => playSfx('correct')}>✅ Correct</button>
          <button type="button" className="btn small" disabled={!settings.sfx} onClick={() => playSfx('wrong')}>❌ Wrong</button>
          <button type="button" className="btn small" disabled={!settings.sfx} onClick={() => playSfx('combo', 5)}>🔥 Combo</button>
          <button type="button" className="btn small" disabled={!settings.sfx} onClick={() => playSfx('fanfare')}>🏆 Finish</button>
        </div>
        <p className="muted small">Confetti and animations follow the “Reduce motion” setting above.</p>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p className="muted small">Progress is stored in this browser. Export a backup to move it or keep it safe.</p>
        <div className="row">
          <button type="button" className="btn" onClick={doExport}>⬇️ Export backup</button>
          <button type="button" className="btn" onClick={() => file.current?.click()}>⬆️ Import backup</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
          <button type="button" className="btn bad" onClick={() => {
            if (confirm('Delete ALL progress? Export a backup first if unsure.')) {
              store.resetAll();
              setMsg('All progress was reset.');
            }
          }}>
            Reset everything
          </button>
        </div>
        {msg && <p role="status">{msg}</p>}
      </section>
    </div>
  );
}
