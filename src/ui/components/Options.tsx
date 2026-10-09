import { useEffect, type ReactNode } from 'react';

export interface Option {
  key: string;
  label: ReactNode;
  /** Accessible text when label is not plain text. */
  ariaLabel?: string;
}

interface Props {
  options: Option[];
  correctKey: string;
  chosen: string | null;
  revealed: boolean;
  onChoose: (key: string) => void;
  /** Number keys 1..n select options. */
  keyboard?: boolean;
  columns?: 1 | 2;
  className?: string;
}

/** Multiple-choice answer buttons with 1–9 keyboard shortcuts and clear feedback states. */
export function Options({ options, correctKey, chosen, revealed, onChoose, keyboard = true, columns = 2, className }: Props) {
  useEffect(() => {
    if (!keyboard || revealed) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
      const n = Number(ev.key);
      if (Number.isInteger(n) && n >= 1 && n <= options.length) {
        ev.preventDefault();
        onChoose(options[n - 1].key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keyboard, revealed, options, onChoose]);

  return (
    <div className={`options cols-${columns} ${className ?? ''}`} role="group" aria-label="Answer options">
      {options.map((o, i) => {
        const isCorrect = revealed && o.key === correctKey;
        const isWrong = revealed && o.key === chosen && o.key !== correctKey;
        return (
          <button
            key={o.key}
            type="button"
            className={`option ${isCorrect ? 'is-correct' : ''} ${isWrong ? 'is-wrong' : ''} ${o.key === chosen ? 'is-chosen' : ''}`}
            onClick={() => !revealed && onChoose(o.key)}
            aria-disabled={revealed}
            aria-label={o.ariaLabel}
          >
            {keyboard && <kbd aria-hidden="true">{i + 1}</kbd>}
            <span className="option-label">{o.label}</span>
            {isCorrect && <span className="mark" aria-label="correct answer">✓</span>}
            {isWrong && <span className="mark" aria-label="your answer, incorrect">✗</span>}
          </button>
        );
      })}
    </div>
  );
}
