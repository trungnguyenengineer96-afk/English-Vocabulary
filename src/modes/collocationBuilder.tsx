import { pick, sample, shuffle } from '../core/rng';
import type { VocabEntry } from '../core/types';
import { TileBuilder, type Tile } from '../ui/components/TileBuilder';
import { Instruction, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
  phrase: string[];
  tiles: Tile[];
}

const multiWord = (e: VocabEntry) => (e.collocations ?? []).filter((c) => c.trim().split(/\s+/).length >= 2);

function CollocationBuilder({ question, report, done, revealed }: ModeProps<Q>) {
  const { target, phrase } = question;
  return (
    <div className="mode collocation-builder">
      <Instruction>
        Build a natural phrase with <strong lang="en">{target.word}</strong> ({meaningText(target)}). Two tiles are decoys.
      </Instruction>
      <TileBuilder
        tiles={question.tiles}
        answer={phrase}
        revealed={revealed}
        label="Your phrase"
        onSubmit={(words) => {
          const ok = words.join(' ').toLowerCase() === phrase.join(' ').toLowerCase();
          report({ vocabId: target.id, result: ok ? 'correct' : 'wrong', given: ok ? undefined : words.join(' ') });
          done();
        }}
      />
      {revealed && target.collocations && target.collocations.length > 1 && (
        <p className="muted">
          More with <span lang="en">{target.word}</span>: <span lang="en">{target.collocations.join(' · ')}</span>
        </p>
      )}
    </div>
  );
}

export const collocationBuilder: ModeDef<Q> = {
  id: 'collocation-builder',
  name: 'Collocation Builder',
  icon: '🔩',
  skill: 'writing',
  weight: 'production',
  blurb: 'Assemble a common word partnership, avoiding decoy tiles.',
  targetsPerQuestion: 1,
  isEligible: (e) => multiWord(e).length > 0,
  build: ([target], { all, rng }) => {
    const options = multiWord(target);
    if (!options.length) return null;
    const phrase = pick(options, rng).split(/\s+/);
    const inPhrase = new Set(phrase.map((w) => w.toLowerCase()));
    // Decoys: words from other entries' collocations that are not in this phrase or any of the target's own.
    const own = new Set((target.collocations ?? []).flatMap((c) => c.toLowerCase().split(/\s+/)));
    const pool = [
      ...new Set(
        all
          .filter((e) => e.id !== target.id)
          .flatMap((e) => (e.collocations ?? []).flatMap((c) => c.split(/\s+/)))
          .filter((w) => /^[a-z-]+$/i.test(w) && w.length > 2 && !inPhrase.has(w.toLowerCase()) && !own.has(w.toLowerCase())),
      ),
    ].sort();
    const decoys = sample(pool, 2, rng);
    if (decoys.length < 2) return null;
    const tiles = shuffle(
      [...phrase.map((text, i) => ({ id: `p${i}`, text })), ...decoys.map((text, i) => ({ id: `d${i}`, text }))],
      rng,
    );
    return { target, phrase, tiles };
  },
  Component: CollocationBuilder,
};
