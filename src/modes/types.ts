import type { ComponentType } from 'react';
import type { Rng } from '../core/rng';
import type { WeightClass } from '../core/scoring';
import type { AnswerResult, Skill, VocabEntry } from '../core/types';

export type ModeId =
  | 'meaning-hunter' | 'word-match' | 'sentence-detective' | 'context-master' | 'odd-one-out' | 'context-clues'
  | 'spell-it' | 'missing-letters' | 'word-scramble' | 'listen-type' | 'translation-challenge' | 'sentence-builder'
  | 'audio-hunter' | 'hear-meaning' | 'sound-twins' | 'stress-detective' | 'audio-gap' | 'sound-sequence'
  | 'flash-recall' | 'picture-quest' | 'word-association' | 'opposite-similar' | 'collocation-builder'
  | 'word-evolution' | 'time-attack' | 'memory-flip' | 'word-maze' | 'combo-streak' | 'boss-battle'
  | 'ultimate-challenge';

export interface BuildContext {
  all: VocabEntry[];
  rng: Rng;
  audioAvailable: boolean;
}

export interface GradedResult {
  vocabId: string;
  result: AnswerResult;
  given?: string;
  hintUsed?: boolean;
  /** 0..1 fraction of time remaining (timed modes only). */
  timeLeft?: number;
}

export interface ModeRuntime {
  /** Speak text with TTS (or recorded audio). Resolves when finished or on failure. */
  speak: (text: string, opts?: { slow?: boolean }) => Promise<void>;
  audioAvailable: boolean;
  /** False in practice mode: timers must not run. */
  timersEnabled: boolean;
  reduceMotion: boolean;
}

export interface ModeProps<Q> {
  question: Q;
  runtime: ModeRuntime;
  /** Report one graded target. Each target must be reported at most once. */
  report: (r: GradedResult) => void;
  /** Signal that the question is finished (all targets reported or given up). */
  done: () => void;
  /** True once the question is finished (answered, or "I don't know" from the player). */
  revealed: boolean;
}

export interface ModeDef<Q = unknown> {
  id: ModeId;
  name: string;
  icon: string;
  skill: Skill;
  weight: WeightClass;
  blurb: string;
  /** Target words consumed by one question instance. */
  targetsPerQuestion: number;
  /** Minimum targets a single question needs (multi-target modes). */
  minTargets?: number;
  timed?: boolean;
  requiresAudio?: boolean;
  /** Can this entry be a target of this mode? Checks data requirements. */
  isEligible: (e: VocabEntry, ctx: Pick<BuildContext, 'all' | 'audioAvailable'>) => boolean;
  /** Build one question for the given targets, or null when it cannot be built. */
  build: (targets: VocabEntry[], ctx: BuildContext) => Q | null;
  Component: ComponentType<ModeProps<Q>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyModeDef = ModeDef<any>;
