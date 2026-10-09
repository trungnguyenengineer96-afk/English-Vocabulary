import type { Skill } from '../core/types';
import { audioGap } from './audioGap';
import { audioHunter } from './audioHunter';
import { bossBattle } from './bossBattle';
import { collocationBuilder } from './collocationBuilder';
import { comboStreak } from './comboStreak';
import { contextClues } from './contextClues';
import { contextMaster } from './contextMaster';
import { flashRecall } from './flashRecall';
import { hearMeaning } from './hearMeaning';
import { listenType } from './listenType';
import { meaningHunter } from './meaningHunter';
import { memoryFlip } from './memoryFlip';
import { missingLetters } from './missingLetters';
import { oddOneOut } from './oddOneOut';
import { oppositeSimilar } from './oppositeSimilar';
import { pictureQuest } from './pictureQuest';
import { sentenceBuilder } from './sentenceBuilder';
import { sentenceDetective } from './sentenceDetective';
import { soundSequence } from './soundSequence';
import { soundTwins } from './soundTwins';
import { spellIt } from './spellIt';
import { stressDetective } from './stressDetective';
import { timeAttack } from './timeAttack';
import { translationChallenge } from './translationChallenge';
import { ultimateChallenge } from './ultimateChallenge';
import { wordAssociation } from './wordAssociation';
import { wordEvolution } from './wordEvolution';
import { wordMatch } from './wordMatch';
import { wordMaze } from './wordMaze';
import { wordScramble } from './wordScramble';
import type { AnyModeDef, ModeId } from './types';

/** All 30 modes, in catalogue order (numbered as in the product brief). */
export const MODES: AnyModeDef[] = [
  meaningHunter,
  wordMatch,
  sentenceDetective,
  contextMaster,
  oddOneOut,
  contextClues,
  spellIt,
  missingLetters,
  wordScramble,
  listenType,
  translationChallenge,
  sentenceBuilder,
  audioHunter,
  hearMeaning,
  soundTwins,
  stressDetective,
  audioGap,
  soundSequence,
  flashRecall,
  pictureQuest,
  wordAssociation,
  oppositeSimilar,
  collocationBuilder,
  wordEvolution,
  timeAttack,
  memoryFlip,
  wordMaze,
  comboStreak,
  bossBattle,
  ultimateChallenge,
];

export const MODE_BY_ID: Map<ModeId, AnyModeDef> = new Map(MODES.map((m) => [m.id, m]));

export const SKILL_LABEL: Record<Skill, { name: string; icon: string; vi: string }> = {
  reading: { name: 'Reading', icon: '📖', vi: 'Đọc hiểu' },
  listening: { name: 'Listening', icon: '🎧', vi: 'Nghe' },
  writing: { name: 'Writing', icon: '✏️', vi: 'Viết' },
  arcade: { name: 'Arcade', icon: '🕹️', vi: 'Trò chơi' },
};

export const modesBySkill = (skill: Skill) => MODES.filter((m) => m.skill === skill);
