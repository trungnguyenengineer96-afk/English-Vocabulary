import { useEffect, useRef, useState } from 'react';

/** Countdown that only runs when `enabled`. Calls onExpire once. */
export function useCountdown(seconds: number, enabled: boolean, running: boolean, onExpire: () => void) {
  const [left, setLeft] = useState(seconds);
  const expired = useRef(false);
  const cb = useRef(onExpire);
  cb.current = onExpire;
  useEffect(() => {
    if (!enabled || !running) return;
    const started = Date.now() - (seconds - left) * 1000;
    const id = setInterval(() => {
      const l = Math.max(0, seconds - (Date.now() - started) / 1000);
      setLeft(l);
      if (l <= 0 && !expired.current) {
        expired.current = true;
        clearInterval(id);
        cb.current();
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, running, seconds]);
  return { left, fraction: enabled ? left / seconds : 1 };
}

export function TimerBar({ fraction, label }: { fraction: number; label: string }) {
  const pct = Math.round(fraction * 100);
  return (
    <div className="timer" role="timer" aria-label={label}>
      <div className={`timer-fill ${pct < 25 ? 'low' : ''}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
