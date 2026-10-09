import type { ReactNode } from 'react';
import type { VocabEntry } from '../core/types';
import { AudioButton } from '../ui/components/AudioButton';
import type { ModeRuntime } from './types';

export const POS_VI: Record<VocabEntry['pos'], string> = {
  noun: 'danh từ', verb: 'động từ', adjective: 'tính từ', adverb: 'trạng từ',
  preposition: 'giới từ', conjunction: 'liên từ', pronoun: 'đại từ', phrase: 'cụm từ',
};

export const POS_SHORT: Record<VocabEntry['pos'], string> = {
  noun: 'n.', verb: 'v.', adjective: 'adj.', adverb: 'adv.', preposition: 'prep.', conjunction: 'conj.', pronoun: 'pron.', phrase: 'phr.',
};

export const meaningText = (e: VocabEntry) => e.meaningsVi.join(', ');
export const exampleForm = (e: VocabEntry) => e.example?.form ?? e.word;

export function Prompt({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="prompt">
      <p className="prompt-text">{children}</p>
      {sub && <p className="prompt-sub">{sub}</p>}
    </div>
  );
}

export function WordHeading({
  entry, runtime, showIpa = true, showAudio = true, showPos = true,
}: { entry: VocabEntry; runtime: ModeRuntime; showIpa?: boolean; showAudio?: boolean; showPos?: boolean }) {
  return (
    <div className="word-heading">
      <span className="big-word" lang="en">{entry.word}</span>
      {showPos && <span className="pos-chip">{POS_SHORT[entry.pos]}</span>}
      {showIpa && entry.ipa && <span className="ipa">{entry.ipa}</span>}
      {showAudio && runtime.audioAvailable && (
        <AudioButton onPlay={(slow) => runtime.speak(entry.word, { slow })} label={`Pronounce ${entry.word}`} />
      )}
    </div>
  );
}

export function Instruction({ children }: { children: ReactNode }) {
  return <p className="instruction">{children}</p>;
}
