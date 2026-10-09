import { pick } from '../core/rng';
import { answersMatch } from '../core/text';
import type { FamilyMember, VocabEntry } from '../core/types';
import { TextAnswer } from '../ui/components/TextAnswer';
import { Instruction, POS_VI, meaningText } from './shared';
import type { ModeDef, ModeProps } from './types';

interface Q {
  target: VocabEntry;
  member: FamilyMember;
}

/** Family members whose part of speech is unambiguous for this word. */
export function evolvable(e: VocabEntry): FamilyMember[] {
  const fam = e.family ?? [];
  return fam.filter(
    (f) => f.pos !== e.pos && fam.filter((g) => g.pos === f.pos).length === 1 && /^[a-z]+$/i.test(f.word),
  );
}

function WordEvolution({ question, report, done, revealed }: ModeProps<Q>) {
  const { target, member } = question;
  return (
    <div className="mode word-evolution">
      <Instruction>Evolve the word into a new part of speech.</Instruction>
      <div className="evolution">
        <div className="evo-stage">
          <span className="big-word small-big" lang="en">{target.word}</span>
          <span className="muted">{POS_VI[target.pos]} · {meaningText(target)}</span>
        </div>
        <span className="evo-arrow" aria-hidden="true">➜</span>
        <div className="evo-stage target">
          <span className="big-word small-big">{revealed ? member.word : '?'}</span>
          <span className="muted">{POS_VI[member.pos]} ({member.pos}) · {member.word.length} letters</span>
        </div>
      </div>
      <TextAnswer
        expected={member.word}
        revealed={revealed}
        label={`The ${member.pos} form of ${target.word}`}
        showLength
        onSubmit={(v) => {
          const ok = answersMatch(v, member.word);
          report({ vocabId: target.id, result: ok ? 'correct' : 'wrong', given: ok ? undefined : v });
          done();
        }}
      />
    </div>
  );
}

export const wordEvolution: ModeDef<Q> = {
  id: 'word-evolution',
  name: 'Word Evolution',
  icon: '🦋',
  skill: 'writing',
  weight: 'production',
  blurb: 'Transform a word into its noun, verb, adjective or adverb form.',
  targetsPerQuestion: 1,
  isEligible: (e) => evolvable(e).length > 0,
  build: ([target], { rng }) => {
    const opts = evolvable(target);
    return opts.length ? { target, member: pick(opts, rng) } : null;
  },
  Component: WordEvolution,
};
