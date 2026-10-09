import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import manifest from '../data/audio-manifest.json';
import { detectEnglishVoice, hasSpeechApi, playUrl, speakText } from './speech';
import { speechKey } from './speechKey';

const CLIPS = manifest as Record<string, string>;
const clipUrl = (text: string) => {
  const file = CLIPS[speechKey(text)];
  return file ? `${import.meta.env.BASE_URL}audio/${file}` : undefined;
};
export const hasClip = (text: string) => !!CLIPS[speechKey(text)];

export type AudioSource = 'clips' | 'clips+voice' | 'voice' | 'none';

interface AudioValue {
  /** True when words can be pronounced (bundled clips or an English system voice). */
  available: boolean;
  checked: boolean;
  source: AudioSource;
  speak: (text: string, opts?: { slow?: boolean }) => Promise<void>;
}

const Ctx = createContext<AudioValue>({ available: false, checked: true, source: 'none', speak: async () => {} });

/**
 * Pronunciation comes from pre-rendered clips bundled with the app (works offline
 * and on systems without an English voice). The system's English TTS voice is
 * only used for text that has no clip.
 */
export function AudioProvider({ children, rate, forceAvailable }: { children: ReactNode; rate: number; forceAvailable?: boolean }) {
  const clipsBundled = Object.keys(CLIPS).length > 0;
  const [voice, setVoice] = useState(false);
  const [checked, setChecked] = useState(forceAvailable !== undefined || !hasSpeechApi());
  useEffect(() => {
    if (forceAvailable !== undefined) return;
    let alive = true;
    detectEnglishVoice().then((ok) => {
      if (!alive) return;
      setVoice(ok);
      setChecked(true);
    });
    return () => {
      alive = false;
    };
  }, [forceAvailable]);

  const available = forceAvailable ?? (clipsBundled || voice);
  const source: AudioSource = forceAvailable === false ? 'none' : clipsBundled ? (voice ? 'clips+voice' : 'clips') : voice ? 'voice' : 'none';

  const speak = useCallback(
    async (text: string, opts?: { slow?: boolean }) => {
      if (!available) return;
      const url = clipUrl(text);
      if (url) {
        const ok = await playUrl(url, opts?.slow ? rate * 0.7 : rate);
        if (ok || !voice) return;
      }
      if (voice) await speakText(text, opts?.slow ? rate * 0.6 : rate);
    },
    [available, rate, voice],
  );
  const value = useMemo(() => ({ available, checked: checked || clipsBundled, source, speak }), [available, checked, clipsBundled, source, speak]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAudio = () => useContext(Ctx);
