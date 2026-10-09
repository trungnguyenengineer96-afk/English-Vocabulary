import { useEffect, useRef, useState } from 'react';
import { isNearMiss } from '../../core/text';

interface Props {
  expected: string;
  revealed: boolean;
  onSubmit: (value: string) => void;
  placeholder?: string;
  label: string;
  hint?: string;
  /** Show letter count boxes under the input. */
  showLength?: boolean;
}

/** Typed answer with submit on Enter; shows the expected answer after reveal. */
export function TextAnswer({ expected, revealed, onSubmit, placeholder, label, hint, showLength }: Props) {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const submit = () => {
    if (revealed || !value.trim()) return;
    setSubmitted(value);
    onSubmit(value);
  };
  const near = submitted !== null && isNearMiss(submitted, expected);
  return (
    <form
      className="text-answer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="sr-only" htmlFor="answer-input">
        {label}
      </label>
      <div className="text-answer-row">
        <input
          id="answer-input"
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder ?? 'Type your answer'}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          readOnly={revealed}
          aria-describedby={hint ? 'answer-hint' : undefined}
        />
        <button type="submit" className="btn primary" disabled={revealed || !value.trim()}>
          Check
        </button>
      </div>
      {showLength && (
        <div className="letter-count" aria-hidden="true">
          {Array.from(expected).map((ch, i) => (
            <span key={i} className={ch === ' ' ? 'gap' : 'slot'} />
          ))}
        </div>
      )}
      {hint && (
        <p id="answer-hint" className="hint">
          {hint}
        </p>
      )}
      {revealed && near && <p className="near-miss">So close! Check the spelling.</p>}
    </form>
  );
}
