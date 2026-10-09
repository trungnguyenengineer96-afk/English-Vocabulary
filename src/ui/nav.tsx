import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SessionPlan } from '../session/planner';

export type Route = 'home' | 'learn' | 'library' | 'play' | 'progress' | 'settings' | 'session';
const ROUTES: Route[] = ['home', 'learn', 'library', 'play', 'progress', 'settings', 'session'];

interface NavValue {
  route: Route;
  go: (r: Route) => void;
  plan: SessionPlan | null;
  startSession: (plan: SessionPlan) => void;
}

const Ctx = createContext<NavValue | null>(null);

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '') as Route;
  return ROUTES.includes(h) ? h : 'home';
}

export function NavProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => {
    const r = parseHash();
    return r === 'session' ? 'home' : r; // a session cannot be restored from the URL
  });
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  useEffect(() => {
    const onHash = () => {
      const r = parseHash();
      setRoute(r === 'session' && !plan ? 'home' : r);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [plan]);
  const go = useCallback((r: Route) => {
    if (r !== 'session') setPlan(null);
    if (window.location.hash !== `#/${r}`) window.location.hash = `/${r}`;
    setRoute(r);
    window.scrollTo?.({ top: 0 });
  }, []);
  const startSession = useCallback(
    (p: SessionPlan) => {
      setPlan(p);
      go('session');
    },
    [go],
  );
  const value = useMemo(() => ({ route, go, plan, startSession }), [route, go, plan, startSession]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNav(): NavValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNav outside NavProvider');
  return v;
}
