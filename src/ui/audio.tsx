import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { detectEnglishVoice, hasSpeechApi, speakText } from './speech';

interface AudioValue {
  /** True once an English TTS voice is confirmed. */
  available: boolean;
  checked: boolean;
  speak: (text: string, opts?: { slow?: boolean }) => Promise<void>;
}

const Ctx = createContext<AudioValue>({ available: false, checked: true, speak: async () => {} });

export function AudioProvider({ children, rate, forceAvailable }: { children: ReactNode; rate: number; forceAvailable?: boolean }) {
  const [available, setAvailable] = useState(forceAvailable ?? false);
  const [checked, setChecked] = useState(forceAvailable !== undefined || !hasSpeechApi());
  useEffect(() => {
    if (forceAvailable !== undefined) return;
    let alive = true;
    detectEnglishVoice().then((ok) => {
      if (!alive) return;
      setAvailable(ok);
      setChecked(true);
    });
    return () => {
      alive = false;
    };
  }, [forceAvailable]);
  const speak = useCallback(
    (text: string, opts?: { slow?: boolean }) => (available ? speakText(text, opts?.slow ? rate * 0.6 : rate) : Promise.resolve()),
    [available, rate],
  );
  const value = useMemo(() => ({ available, checked, speak }), [available, checked, speak]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAudio = () => useContext(Ctx);
