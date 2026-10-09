import { useEffect } from 'react';
import { WORDS } from '../data/words';
import { SessionPlayer } from '../session/SessionPlayer';
import { reviewPlan } from '../session/launch';
import { useStore } from '../state/store';
import { AudioProvider, useAudio } from './audio';
import { NavProvider, useNav, type Route } from './nav';
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

  const inSession = route === 'session' && plan;
  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      {!inSession && (
        <header className="topbar">
          <button type="button" className="brand" onClick={() => go('home')}>
            <span aria-hidden="true">🧭</span> Vocab Quest
          </button>
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
        {inSession ? (
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

export function App({ forceAudio }: { forceAudio?: boolean }) {
  const { data } = useStore();
  return (
    <AudioProvider rate={data.settings.speechRate} forceAvailable={forceAudio}>
      <NavProvider>
        <Shell />
      </NavProvider>
    </AudioProvider>
  );
}
