import { useState } from 'react';

interface Props {
  onPlay: (slow: boolean) => Promise<void>;
  label?: string;
  autoFocus?: boolean;
  big?: boolean;
  showSlow?: boolean;
}

/** Play + slow replay controls. */
export function AudioButton({ onPlay, label = 'Play audio', autoFocus, big, showSlow = true }: Props) {
  const [playing, setPlaying] = useState(false);
  const play = async (slow: boolean) => {
    setPlaying(true);
    try {
      await onPlay(slow);
    } finally {
      setPlaying(false);
    }
  };
  return (
    <span className={`audio-controls ${big ? 'big' : ''}`}>
      <button type="button" className="btn audio" onClick={() => play(false)} aria-label={label} autoFocus={autoFocus}>
        <span aria-hidden="true">{playing ? '🔊' : '🔈'}</span> {big ? 'Play' : null}
      </button>
      {showSlow && (
        <button type="button" className="btn audio ghost" onClick={() => play(true)} aria-label={`${label} slowly`}>
          <span aria-hidden="true">🐢</span>
          {big ? ' Slow' : null}
        </button>
      )}
    </span>
  );
}
