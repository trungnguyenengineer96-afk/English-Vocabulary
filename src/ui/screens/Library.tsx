import { useMemo, useRef, useState } from 'react';
import { queryLibrary, type LibrarySort } from '../../core/library';
import { recentAccuracy } from '../../core/scheduler';
import type { LearningState, LibraryItem } from '../../core/types';
import { VOCAB, WORDS } from '../../data/words';
import { meaningText, POS_SHORT } from '../../modes/shared';
import { reviewPlan } from '../../session/launch';
import { useStore } from '../../state/store';
import { useAudio } from '../audio';
import { WordCard } from '../components/WordCard';
import { formatDue, relativeDay } from '../format';
import { useNav } from '../nav';

const STATES: LearningState[] = ['new', 'learning', 'familiar', 'mastered'];
const TAGS = [...new Set(WORDS.flatMap((w) => w.tags))].sort();

export function Library() {
  const store = useStore();
  const { data, now } = store;
  const { startSession } = useNav();
  const audio = useAudio();
  const [query, setQuery] = useState('');
  const [states, setStates] = useState<LearningState[]>([]);
  const [fav, setFav] = useState(false);
  const [dueOnly, setDueOnly] = useState(false);
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState<LibrarySort>('recent');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<string | null>(null);
  const [bank, setBank] = useState(false);
  const t = now();

  const rows = useMemo(
    () => queryLibrary(data.library, VOCAB, { query, states, favoritesOnly: fav, tag: tag || undefined, dueOnly, now: t }, sort),
    [data.library, query, states, fav, tag, dueOnly, sort, t],
  );
  const total = Object.keys(data.library).length;

  const toggleSel = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  };
  const reviewIds = (ids: string[]) =>
    startSession(reviewPlan({ data, now: t, audioAvailable: audio.available }, { only: ids, size: ids.length }));

  return (
    <div className="library">
      <section className="card">
        <div className="lib-head">
          <h1>📚 My word library</h1>
          <span className="muted">{total} saved word{total === 1 ? '' : 's'}</span>
          <button type="button" className="btn small ghost" onClick={() => setBank(!bank)} aria-expanded={bank}>
            {bank ? 'Hide word bank' : '➕ Browse word bank'}
          </button>
        </div>
        {bank && <WordBank />}
        <div className="filters">
          <label className="search">
            <span className="sr-only">Search words or meanings</span>
            <input type="search" placeholder="Search English or Vietnamese…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="chip-row" role="group" aria-label="Filter by learning state">
            {STATES.map((s) => (
              <button
                key={s}
                type="button"
                className={`chip state-${s} ${states.includes(s) ? 'active' : ''}`}
                aria-pressed={states.includes(s)}
                onClick={() => setStates(states.includes(s) ? states.filter((x) => x !== s) : [...states, s])}
              >
                {s}
              </button>
            ))}
            <button type="button" className={`chip ${fav ? 'active' : ''}`} aria-pressed={fav} onClick={() => setFav(!fav)}>
              ★ favorites
            </button>
            <button type="button" className={`chip ${dueOnly ? 'active' : ''}`} aria-pressed={dueOnly} onClick={() => setDueOnly(!dueOnly)}>
              ⏰ due
            </button>
          </div>
          <div className="row">
            <label>
              Topic{' '}
              <select value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">All</option>
                {TAGS.map((tg) => (
                  <option key={tg} value={tg}>{tg}</option>
                ))}
              </select>
            </label>
            <label>
              Sort{' '}
              <select value={sort} onChange={(e) => setSort(e.target.value as LibrarySort)}>
                <option value="recent">Recently added</option>
                <option value="alpha">A–Z</option>
                <option value="due">Next review</option>
                <option value="weakest">Weakest first</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      {selected.size > 0 && (
        <div className="selection-bar" role="region" aria-label="Selection">
          <span>{selected.size} selected</span>
          <button type="button" className="btn primary small" onClick={() => reviewIds([...selected])}>
            Review selected
          </button>
          <button type="button" className="btn ghost small" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="card muted">{total === 0 ? 'Your library is empty. Learn today’s words to start collecting.' : 'No words match these filters.'}</p>
      ) : (
        <ul className="lib-list" aria-label="Library words">
          {rows.map(({ item, entry }) => (
            <li key={item.vocabId} className="lib-row">
              <input
                type="checkbox"
                checked={selected.has(item.vocabId)}
                onChange={() => toggleSel(item.vocabId)}
                aria-label={`Select ${entry.word} for manual review`}
              />
              <button type="button" className="lib-main" onClick={() => setDetail(item.vocabId)}>
                <span className="lib-word" lang="en">{entry.word}</span>
                <span className="pos-chip">{POS_SHORT[entry.pos]}</span>
                <span className="lib-meaning">{meaningText(entry)}</span>
              </button>
              <span className={`state-pill ${item.state}`}>{item.state}</span>
              <span className="muted small lib-due">{formatDue(item.dueAt, t)}</span>
              <button
                type="button"
                className={`star ${item.favorite ? 'on' : ''}`}
                aria-pressed={item.favorite}
                aria-label={item.favorite ? `Unfavorite ${entry.word}` : `Favorite ${entry.word}`}
                onClick={() => store.toggleFav(item.vocabId)}
              >
                {item.favorite ? '★' : '☆'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {detail && data.library[detail] && (
        <WordDetail item={data.library[detail]} onClose={() => setDetail(null)} onReview={() => reviewIds([detail])} />
      )}
    </div>
  );
}

function WordDetail({ item, onClose, onReview }: { item: LibraryItem; onClose: () => void; onReview: () => void }) {
  const store = useStore();
  const entry = VOCAB.get(item.vocabId)!;
  const t = store.now();
  const acc = recentAccuracy(item, 10);
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-label={`${entry.word} details`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        ref={ref as never}
      >
        <button type="button" className="btn ghost small close" onClick={onClose} aria-label="Close" autoFocus>✕</button>
        <WordCard entry={entry} />
        <dl className="stats-grid">
          <dt>State</dt><dd><span className={`state-pill ${item.state}`}>{item.state}</span></dd>
          <dt>Confidence</dt><dd>{Math.round(item.confidence * 100)}%</dd>
          <dt>Next review</dt><dd>{formatDue(item.dueAt, t)}</dd>
          <dt>Interval</dt><dd>{item.intervalDays} day{item.intervalDays === 1 ? '' : 's'}</dd>
          <dt>Answers</dt><dd>✓ {item.correctCount} · ✗ {item.wrongCount} · 🤷 {item.unsureCount}</dd>
          <dt>Recent accuracy</dt><dd>{acc === undefined ? '—' : `${Math.round(acc * 100)}% (last ${Math.min(10, item.history.length)})`}</dd>
          <dt>Last review</dt><dd>{item.lastReviewedAt ? relativeDay(item.lastReviewedAt, t) : 'never'}</dd>
          <dt>Added</dt><dd>{relativeDay(item.addedAt, t)} ({item.source})</dd>
        </dl>
        {item.history.some((h) => h.result !== 'correct') && (
          <details>
            <summary>Mistake history</summary>
            <ul className="history">
              {item.history.filter((h) => h.result !== 'correct').slice(-8).reverse().map((h, i) => (
                <li key={i}>
                  {relativeDay(h.at, t)} · {h.mode} · {h.result === 'unsure' ? "I don't know" : `answered “${h.given ?? '?'}”`}
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="row">
          <button type="button" className="btn primary" onClick={onReview}>Review now</button>
          <button type="button" className="btn" onClick={() => store.toggleFav(item.vocabId)}>
            {item.favorite ? '★ Favorited' : '☆ Favorite'}
          </button>
        </div>
      </div>
    </div>
  );
}

function WordBank() {
  const store = useStore();
  const [q, setQ] = useState('');
  const list = WORDS.filter((w) => !store.data.library[w.id] && (!q || w.word.includes(q.toLowerCase()))).slice(0, 40);
  return (
    <div className="word-bank">
      <p className="muted small">Add specific words manually. Daily selection skips words you already saved.</p>
      <input type="search" placeholder="Find a word…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a word in the word bank" />
      <ul className="bank-list">
        {list.map((w) => (
          <li key={w.id}>
            <span lang="en">{w.word}</span> <span className="muted small">{meaningText(w)}</span>
            <button type="button" className="btn small" onClick={() => store.addManual(w.id)} aria-label={`Add ${w.word}`}>+ Add</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
