import { useEffect, useState } from 'react';

export interface Tile {
  id: string;
  text: string;
}

interface Props {
  tiles: Tile[];
  /** Expected sequence of tile texts. */
  answer: string[];
  revealed: boolean;
  onSubmit: (texts: string[]) => void;
  joiner?: string;
  /** Let physical keyboard letters pick matching tiles (single-letter tiles). */
  typeToPick?: boolean;
  label: string;
  /** Text shown as the correct answer on reveal (defaults to the joined answer). */
  revealText?: string;
}

/** Tap tiles to build a sequence; tap a placed tile to return it. */
export function TileBuilder({ tiles, answer, revealed, onSubmit, joiner = ' ', typeToPick, label, revealText }: Props) {
  const [placed, setPlaced] = useState<string[]>([]);
  const byId = new Map(tiles.map((t) => [t.id, t]));
  const texts = placed.map((id) => byId.get(id)!.text);
  const full = placed.length === answer.length;

  const add = (id: string) => {
    if (revealed || placed.includes(id) || placed.length >= answer.length) return;
    setPlaced([...placed, id]);
  };
  const remove = (id: string) => !revealed && setPlaced(placed.filter((p) => p !== id));

  useEffect(() => {
    if (!typeToPick || revealed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        setPlaced((p) => p.slice(0, -1));
      } else if (e.key === 'Enter' && full) {
        e.preventDefault();
        onSubmit(texts);
      } else if (/^[a-z'-]$/i.test(e.key)) {
        const t = tiles.find((x) => !placed.includes(x.id) && x.text.toLowerCase() === e.key.toLowerCase());
        if (t) {
          e.preventDefault();
          add(t.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const correct = revealed && texts.join(joiner).toLowerCase() === answer.join(joiner).toLowerCase();
  return (
    <div className="tile-builder">
      <div className={`tile-slots ${revealed ? (correct ? 'ok' : 'bad') : ''}`} aria-label={`${label}: ${texts.join(joiner) || 'empty'}`} role="group">
        {Array.from({ length: answer.length }, (_, i) => {
          const id = placed[i];
          return id ? (
            <button key={i} type="button" className="tile placed" onClick={() => remove(id)} aria-label={`Remove ${byId.get(id)!.text}`}>
              {byId.get(id)!.text}
            </button>
          ) : (
            <span key={i} className="tile slot" aria-hidden="true" />
          );
        })}
      </div>
      {revealed && !correct && (
        <p className="answer-reveal" lang="en">{revealText ?? answer.join(joiner)}</p>
      )}
      <div className="tile-pool" role="group" aria-label="Available tiles">
        {tiles.map((t) => (
          <button key={t.id} type="button" className="tile" onClick={() => add(t.id)} disabled={placed.includes(t.id) || revealed} lang="en">
            {t.text}
          </button>
        ))}
      </div>
      {!revealed && (
        <div className="row center">
          <button type="button" className="btn small ghost" onClick={() => setPlaced([])} disabled={!placed.length}>Clear</button>
          <button type="button" className="btn primary" onClick={() => onSubmit(texts)} disabled={!full}>
            Check
          </button>
        </div>
      )}
    </div>
  );
}
