import { useEffect } from 'react';
import { WORDS } from '../data/words';
import { SessionPlayer } from '../session/SessionPlayer';
import { reviewPlan } from '../session/launch';
import { useStore } from '../state/store';
import { AudioProvider, useAudio } from './audio';
import { configureSfx } from './sfx';
import { NavProvider, useNav, type Route } from './nav';
import { useProfile } from './profiles/ProfileContext';
import { Path } from './screens/Path';
import { Placement } from './screens/Placement';
import { Dashboard } from './screens/Dashboard';
import { Learn } from './screens/Learn';
import { Library } from './screens/Library';
import { Play } from './screens/Play';
import { Progress } from './screens/Progress';
import { Settings } from './screens/Settings';

const TABS: { route: Route; label: string; icon: string }[] = [
  { route: 'home', label: 'Home', icon: '🏠' },
  { route: 'learn', label: 'Learn', icon: '🌱' },
  { route: 'library', label: 'Library', icon: '📚' },
  { route: 'play', label: 'Play', icon: '🎮' },
  { route: 'path', label: 'Path', icon: '🗺️' },
  { route: 'progress', label: 'Progress', icon: '🏅' },
  { route: 'settings', label: 'Settings', icon: '⚙️' },
];

function Shell() {
  const { route, go, plan, startSession } = useNav();
  const { data, notices, now } = useStore();
  const audio = useAudio();
  const reduce = data.settings.reduceMotion;
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduce);
  }, [reduce]);
  useEffect(() => {
    configureSfx({ enabled: data.settings.sfx, volume: data.settings.sfxVolume });
  }, [data.settings.sfx, data.settings.sfxVolume]);

  const profile = useProfile();
  const inSession = (route === 'session' && plan) || route === 'placement';
  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      {!inSession && (
        <header className="topbar">
          <div className="brand-row">
            <button type="button" className="brand" onClick={() => go('home')}>
              <span aria-hidden="true">🧭</span> Vocab Quest
            </button>
            {profile && (
              <button type="button" className="profile-chip" style={{ ['--pc' as string]: profile.profile.color }}
                onClick={profile.switchProfile} aria-label={`Đổi người học (đang là ${profile.profile.name})`} title="Đổi người học">
                <span aria-hidden="true">{profile.profile.avatar}</span>
                <span className="profile-chip-name">{profile.profile.name}</span>
                <span aria-hidden="true">⇄</span>
              </button>
            )}
          </div>
          <nav aria-label="Main">
            <ul className="tabs">
              {TABS.map((t) => (
                <li key={t.route}>
                  <button
                    type="button"
                    className={`tab ${route === t.route ? 'active' : ''}`}
                    aria-current={route === t.route ? 'page' : undefined}
                    aria-label={t.label}
                    onClick={() => go(t.route)}
                  >
                    <span aria-hidden="true">{t.icon}</span>
                    <span className="tab-label">{t.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </header>
      )}
      {notices.length > 0 && !inSession && (
        <div className="notices" role="status">
          {notices.map((n) => <p key={n}>{n}</p>)}
        </div>
      )}
      <main id="main" tabIndex={-1}>
        {route === 'placement' ? (
          <Placement />
        ) : route === 'session' && plan ? (
          <SessionPlayer
            key={plan.id}
            plan={plan}
            onExit={() => go('home')}
            onReplay={(ids) => startSession(reviewPlan({ data, now: now(), audioAvailable: audio.available }, { only: ids, size: ids.length }))}
          />
        ) : route === 'learn' ? (
          <Learn />
        ) : route === 'library' ? (
          <Library />
        ) : route === 'play' ? (
          <Play />
        ) : route === 'path' ? (
          <Path />
        ) : route === 'progress' ? (
          <Progress />
        ) : route === 'settings' ? (
          <Settings />
        ) : (
          <Dashboard />
        )}
      </main>
      {!inSession && (
        <footer className="footer muted small">
          {WORDS.length} words in the word bank · progress is saved in this browser
        </footer>
      )}
    </div>
  );
}

export function App({ forceAudio, initialRoute }: { forceAudio?: boolean; initialRoute?: Route }) {
  const { data } = useStore();
  return (
    <AudioProvider rate={data.settings.speechRate} forceAvailable={forceAudio}>
      <NavProvider initialRoute={initialRoute}>
        <Shell />
      </NavProvider>
    </AudioProvider>
  );
}
