// Core data model. Content types describe static vocabulary; library types
// describe a single learner's progress. Optional content fields are omitted
// when the data is unknown — consumers must never invent replacements.

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'preposition'
  | 'conjunction'
  | 'pronoun'
  | 'phrase';

/** 1 = A1 … 5 = C1 */
export type Difficulty = 1 | 2 | 3 | 4 | 5;
/** 1 = rare … 5 = very common */
export type Frequency = 1 | 2 | 3 | 4 | 5;

export interface Example {
  en: string;
  vi?: string;
  /** Surface form of the target word inside `en` when it differs from `word` (e.g. "decided"). */
  form?: string;
}

export interface FamilyMember {
  word: string;
  pos: PartOfSpeech;
}

export interface VocabEntry {
  id: string;
  word: string;
  ipa?: string;
  pos: PartOfSpeech;
  meaningsVi: string[];
  definitionEn?: string;
  example?: Example;
  synonyms?: string[];
  antonyms?: string[];
  collocations?: string[];
  family?: FamilyMember[];
  difficulty: Difficulty;
  frequency: Frequency;
  tags: string[];
  /** Syllables in spelling order, e.g. ["ad", "ven", "ture"]. Only for words with 2+ syllables. */
  syllables?: string[];
  /** Index into `syllables` of the primary stress. */
  stressIndex?: number;
  /** A single emoji that clearly depicts the word (concrete nouns only). */
  emoji?: string;
  /** Real English words commonly confused with this one by sound or spelling. */
  confusables?: string[];
  /** Recorded pronunciation, when available. TTS is used otherwise. */
  audio?: { url?: string };
}

export type LearningState = 'new' | 'learning' | 'familiar' | 'mastered';
export type AnswerResult = 'correct' | 'wrong' | 'unsure';
export type Skill = 'reading' | 'listening' | 'writing' | 'arcade';

export interface Attempt {
  at: number;
  mode: string;
  skill: Skill;
  result: AnswerResult;
  /** What the learner answered, for wrong answers. */
  given?: string;
  sessionId?: string;
}

export interface LibraryItem {
  vocabId: string;
  addedAt: number;
  source: 'daily' | 'manual' | 'placement';
  favorite: boolean;
  state: LearningState;
  /** 0..1 */
  confidence: number;
  ease: number;
  intervalDays: number;
  /** Successful reviews on separate, properly spaced days since the last lapse. */
  reps: number;
  lapses: number;
  dueAt: number;
  lastReviewedAt?: number;
  /** Local day key (YYYY-MM-DD) of the last credited success. */
  lastSuccessDay?: string;
  /** Local day key of the last lapse (to count lapses once per day). */
  lastLapseDay?: string;
  lastMissAt?: number;
  lastResult?: AnswerResult;
  correctCount: number;
  wrongCount: number;
  unsureCount: number;
  history: Attempt[];
}

export type LearnerLevel = 'beginner' | 'intermediate' | 'advanced';
export type DailyGoal = 7 | 10 | 20 | 30;

export interface ReviewWeights {
  mistakes: number;
  due: number;
  weak: number;
  reinforcement: number;
}

export interface Settings {
  dailyGoal: DailyGoal;
  level: LearnerLevel;
  /** Practice mode: disables every timer. */
  practiceMode: boolean;
  reduceMotion: boolean;
  testSize: number;
  speechRate: number;
  weights: ReviewWeights;
  showBoss: boolean;
  /** Sound effects (correct/wrong/select/next…). */
  sfx: boolean;
  /** 0..1 */
  sfxVolume: number;
  /** Topic tags to favour for new words (from the placement survey). */
  interests: string[];
  /** Use the placement test's ability estimate for new-word difficulty. */
  autoLevel: boolean;
}

export type Cefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export type PlacementKind = 'meaning' | 'context' | 'listening' | 'spelling';

export interface PlacementAnswer {
  vocabId: string;
  difficulty: number;
  kind: PlacementKind;
  result: AnswerResult;
}

export interface PlacementResult {
  takenAt: number;
  /** Ability estimate on the 1 (A1) … 5 (C1) difficulty scale. */
  theta: number;
  /** Standard error of the estimate. */
  se: number;
  cefr: Cefr;
  answers: PlacementAnswer[];
  skills: Record<'reading' | 'listening' | 'writing', { correct: number; total: number }>;
  weakSkill?: Skill;
  goals: string[];
  minutesPerDay: number;
  selfRating: number;
}

export interface DailyPlan {
  date: string;
  goal: DailyGoal;
  vocabIds: string[];
  learnedIds: string[];
  /** Constraints that had to be relaxed because the pool was too small. */
  relaxed: string[];
}

export interface SessionSummary {
  id: string;
  kind: 'review' | 'mixed' | 'mode' | 'daily-check';
  modeId?: string;
  startedAt: number;
  finishedAt: number;
  total: number;
  answered: number;
  correct: number;
  graded: number;
  xp: number;
  points: number;
  wrongIds: string[];
}

export interface AppData {
  schemaVersion: number;
  settings: Settings;
  library: Record<string, LibraryItem>;
  dailyPlans: Record<string, DailyPlan>;
  sessions: SessionSummary[];
  xp: number;
  achievements: Record<string, number>;
  modeStats: Record<string, { played: number; correct: number; graded: number }>;
  activityDays: string[];
  placement?: PlacementResult;
}
