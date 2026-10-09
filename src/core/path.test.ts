import { WORDS } from '../data/words';
import { buildPath, startBand } from './path';
import { todaysQuests } from './quests';
import { newLibraryItem } from './scheduler';
import { defaultData } from './storage';
import type { AppData } from './types';

const NOW = new Date(2026, 9, 9, 9).getTime();

describe('learning path', () => {
  it('starts at the placement band and marks lower bands as foundation', () => {
    const d: AppData = { ...defaultData(), placement: { theta: 3.2 } as never };
    expect(startBand(d)).toBe(3);
    const stages = buildPath(d, WORDS);
    expect(stages.map((s) => s.status)).toEqual(['foundation', 'foundation', 'current', 'next', 'ahead']);
    expect(stages.reduce((s, x) => s + x.total, 0)).toBe(WORDS.length);
  });

  it('a stage is conquered with ≥80% learned and ≥40% mastered; the current stage moves on', () => {
    const d: AppData = { ...defaultData(), settings: { ...defaultData().settings, level: 'beginner' } };
    const a1 = WORDS.filter((w) => w.difficulty === 1);
    a1.forEach((w, i) => {
      d.library[w.id] = { ...newLibraryItem(w.id, NOW, 'daily'), state: i < Math.ceil(a1.length * 0.4) ? 'mastered' : 'learning' };
    });
    const stages = buildPath(d, WORDS);
    expect(stages[0].status).toBe('conquered');
    expect(stages[1].status).toBe('current');
    expect(stages[0].toLearn).toBe(0);
  });
});

describe("today's quests", () => {
  it('tracks review, learning, weak-skill practice and the optional challenge', () => {
    const d = defaultData();
    d.library['apple-n'] = newLibraryItem('apple-n', NOW - 1000, 'daily');
    let q = todaysQuests(d, NOW, 'listening', () => 'listening');
    expect(q.map((x) => [x.id, x.done])).toEqual([['review', false], ['learn', false], ['skill', false], ['mixed', false]]);
    expect(q[0].count).toBe(1);
    d.sessions.push({ id: 's', kind: 'mode', modeId: 'listen-type', startedAt: NOW, finishedAt: NOW, total: 1, answered: 1, correct: 1, graded: 1, xp: 1, points: 1, wrongIds: [] });
    q = todaysQuests(d, NOW, 'listening', (m) => (m === 'listen-type' ? 'listening' : 'reading'));
    expect(q.find((x) => x.id === 'skill')!.done).toBe(true);
    expect(todaysQuests(d, NOW, 'writing', (m) => (m === 'listen-type' ? 'listening' : 'reading')).find((x) => x.id === 'skill')!.done).toBe(false);
  });
});
