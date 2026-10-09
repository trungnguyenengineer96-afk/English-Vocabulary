import type { Skill } from '../core/types';
import { contextMaster } from './contextMaster';
import { flashRecall } from './flashRecall';
import { hearMeaning } from './hearMeaning';
import { listenType } from './listenType';
import { meaningHunter } from './meaningHunter';
import { missingLetters } from './missingLetters';
import { spellIt } from './spellIt';
import { wordMatch } from './wordMatch';
import type { AnyModeDef, ModeId } from './types';

/** All implemented modes, in catalogue order. */
export const MODES: AnyModeDef[] = [
  meaningHunter,
  wordMatch,
  contextMaster,
  spellIt,
  missingLetters,
  listenType,
  hearMeaning,
  flashRecall,
];

export const MODE_BY_ID: Map<ModeId, AnyModeDef> = new Map(MODES.map((m) => [m.id, m]));

export const SKILL_LABEL: Record<Skill, { name: string; icon: string; vi: string }> = {
  reading: { name: 'Reading', icon: '📖', vi: 'Đọc hiểu' },
  listening: { name: 'Listening', icon: '🎧', vi: 'Nghe' },
  writing: { name: 'Writing', icon: '✏️', vi: 'Viết' },
  arcade: { name: 'Arcade', icon: '🕹️', vi: 'Trò chơi' },
};

export const modesBySkill = (skill: Skill) => MODES.filter((m) => m.skill === skill);
