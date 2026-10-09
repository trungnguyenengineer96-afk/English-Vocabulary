import type { VocabEntry } from '../../core/types';
import { POS_VI, POS_SHORT } from '../../modes/shared';
import { useAudio } from '../audio';
import { AudioButton } from './AudioButton';

/** Full word details. Only fields present in the data are shown. */
export function WordCard({ entry, compact }: { entry: VocabEntry; compact?: boolean }) {
  const audio = useAudio();
  const e = entry;
  return (
    <article className={`word-card ${compact ? 'compact' : ''}`} aria-label={`Word: ${e.word}`}>
      <header className="wc-head">
        {e.emoji && <span className="wc-emoji" aria-hidden="true">{e.emoji}</span>}
        <div>
          <h3 className="wc-word" lang="en">{e.word}</h3>
          <p className="wc-meta">
            <span className="pos-chip" title={POS_VI[e.pos]}>{POS_SHORT[e.pos]}</span>
            {e.ipa && <span className="ipa">{e.ipa}</span>}
            <span className="level-chip">{['A1', 'A2', 'B1', 'B2', 'C1'][e.difficulty - 1]}</span>
          </p>
        </div>
        {audio.available && (
          <AudioButton onPlay={(slow) => audio.speak(e.word, { slow })} label={`Pronounce ${e.word}`} />
        )}
      </header>
      <ul className="wc-meanings">
        {e.meaningsVi.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      {e.definitionEn && <p className="wc-def" lang="en">{e.definitionEn}</p>}
      {e.example && (
        <blockquote className="wc-example">
          <p lang="en">
            {e.example.en}
            {audio.available && (
              <AudioButton onPlay={(slow) => audio.speak(e.example!.en, { slow })} label="Play example sentence" showSlow={false} />
            )}
          </p>
          {e.example.vi && <p className="muted">{e.example.vi}</p>}
        </blockquote>
      )}
      {!compact && (
        <dl className="wc-extra">
          {e.synonyms?.length ? (<><dt>Synonyms</dt><dd lang="en">{e.synonyms.join(', ')}</dd></>) : null}
          {e.antonyms?.length ? (<><dt>Antonyms</dt><dd lang="en">{e.antonyms.join(', ')}</dd></>) : null}
          {e.collocations?.length ? (<><dt>Collocations</dt><dd lang="en">{e.collocations.join(' · ')}</dd></>) : null}
          {e.family?.length ? (
            <><dt>Word family</dt><dd lang="en">{e.family.map((f) => `${f.word} (${POS_SHORT[f.pos]})`).join(', ')}</dd></>
          ) : null}
          {e.confusables?.length ? (<><dt>Don't confuse with</dt><dd lang="en">{e.confusables.join(', ')}</dd></>) : null}
          <dt>Topics</dt>
          <dd>{e.tags.join(', ')}</dd>
        </dl>
      )}
    </article>
  );
}
