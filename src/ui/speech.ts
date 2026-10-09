// Text-to-speech via the Web Speech API. Listening features are only enabled
// when an English voice is actually available.

export function hasSpeechApi(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

function englishVoices(): SpeechSynthesisVoice[] {
  if (!hasSpeechApi()) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
}

/** Resolve once voices are known (some browsers load them asynchronously). */
export function detectEnglishVoice(timeoutMs = 1500): Promise<boolean> {
  if (!hasSpeechApi()) return Promise.resolve(false);
  if (englishVoices().length) return Promise.resolve(true);
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const done = () => {
      synth.removeEventListener?.('voiceschanged', done);
      clearTimeout(t);
      resolve(englishVoices().length > 0);
    };
    const t = setTimeout(done, timeoutMs);
    synth.addEventListener?.('voiceschanged', done);
  });
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = englishVoices();
  return voices.find((v) => v.lang === 'en-US' && v.localService) ?? voices.find((v) => v.lang === 'en-US') ?? voices[0];
}

export function speakText(text: string, rate: number): Promise<void> {
  if (!hasSpeechApi()) return Promise.resolve();
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-US';
    u.rate = rate;
    // Resolve on end/error, and as a safety net after a generous timeout.
    const safety = setTimeout(resolve, 1500 + text.length * 150);
    u.onend = u.onerror = () => {
      clearTimeout(safety);
      resolve();
    };
    synth.speak(u);
  });
}

export function playUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const a = new Audio(url);
    a.onended = () => resolve(true);
    a.onerror = () => resolve(false);
    a.play().catch(() => resolve(false));
  });
}
