import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { createRng } from '../core/rng';
import { VOCAB, WORDS } from '../data/words';
import { MODES, MODE_BY_ID } from './registry';
import type { AnyModeDef, GradedResult, ModeId, ModeRuntime } from './types';

const e = (id: string) => VOCAB.get(id)!;

function setup(id: ModeId, targetIds: string[], opts: { seed?: number; runtime?: Partial<ModeRuntime> } = {}) {
  const mode = MODE_BY_ID.get(id) as AnyModeDef;
  const q = mode.build(targetIds.map(e), { all: WORDS, rng: createRng(opts.seed ?? 1), audioAvailable: true });
  if (!q) throw new Error(`could not build ${id}`);
  const reports: GradedResult[] = [];
  const doneCalls = { n: 0 };
  const runtime: ModeRuntime = {
    speak: vi.fn(async () => {}),
    audioAvailable: true,
    timersEnabled: false,
    reduceMotion: true,
    onAchievement: vi.fn(),
    ...opts.runtime,
  };
  function Harness() {
    const [revealed, setRevealed] = useState(false);
    const C = mode.Component;
    return (
      <C
        question={q}
        runtime={runtime}
        report={(r: GradedResult) => reports.push(r)}
        done={() => {
          doneCalls.n++;
          setRevealed(true);
        }}
        revealed={revealed}
      />
    );
  }
  render(<Harness />);
  return { q, reports, doneCalls, runtime, user: userEvent.setup() };
}

describe('every mode renders and can be answered or abandoned without crashing', () => {
  it.each(MODES.map((m) => [m.id] as const))('%s renders', (id) => {
    const m = MODE_BY_ID.get(id)!;
    const pool = WORDS.filter((w) => m.isEligible(w, { all: WORDS, audioAvailable: true }));
    const targets = Array.from({ length: m.targetsPerQuestion }, (_, k) => pool[(k * 11) % pool.length].id);
    setup(id, new Set(targets).size === targets.length ? targets : targets.slice(0, 1), { seed: 3 });
    expect(document.body.querySelector('.mode')).not.toBeNull();
  });
});

describe('mode interactions', () => {
  it('Meaning Hunter: picking the right meaning reports correct', async () => {
    const { reports, doneCalls, user } = setup('meaning-hunter', ['apple-n']);
    await user.click(screen.getByRole('button', { name: /quả táo/ }));
    expect(reports).toEqual([{ vocabId: 'apple-n', result: 'correct', given: undefined }]);
    expect(doneCalls.n).toBe(1);
  });

  it('Spell It: wrong spelling reports wrong with the given answer; hint halves', async () => {
    const { reports, user } = setup('spell-it', ['umbrella-n']);
    await user.click(screen.getByRole('button', { name: /Hint/ }));
    await user.type(screen.getByLabelText('English spelling'), 'umbrela{Enter}');
    expect(reports[0]).toMatchObject({ result: 'wrong', given: 'umbrela', hintUsed: true });
    expect(screen.getByText('So close! Check the spelling.')).toBeInTheDocument();
  });

  it('Word Match: a wrong pairing before the right one marks that word wrong', async () => {
    const ids = ['apple-n', 'river-n', 'salary-n'];
    const { reports, doneCalls, user } = setup('word-match', ids);
    await user.click(screen.getByRole('button', { name: 'apple' }));
    await user.click(screen.getByRole('button', { name: 'dòng sông' }));
    await user.click(screen.getByRole('button', { name: 'quả táo' }));
    await user.click(screen.getByRole('button', { name: 'river' }));
    await user.click(screen.getByRole('button', { name: 'dòng sông' }));
    await user.click(screen.getByRole('button', { name: 'salary' }));
    await user.click(screen.getByRole('button', { name: 'tiền lương' }));
    expect(reports.map((r) => [r.vocabId, r.result])).toEqual([
      ['apple-n', 'wrong'], ['river-n', 'correct'], ['salary-n', 'correct'],
    ]);
    expect(doneCalls.n).toBe(1);
  });

  it('Sentence Detective: tapping the target token is correct', async () => {
    const { reports, user } = setup('sentence-detective', ['decide-v']);
    await user.click(screen.getByRole('button', { name: 'decided' }));
    expect(reports[0].result).toBe('correct');
  });

  it('Word Scramble: typing letters on the keyboard builds the word', async () => {
    const { reports, user } = setup('word-scramble', ['river-n']);
    await user.keyboard('river');
    await user.keyboard('{Enter}');
    expect(reports[0]).toMatchObject({ vocabId: 'river-n', result: 'correct' });
  });

  it('Opposite & Similar: sorting all chips correctly is correct', async () => {
    const { q, reports, user } = setup('opposite-similar', ['happy-adj']);
    for (const c of (q as { chips: { word: string; bin: string }[] }).chips) {
      const group = screen.getByRole('radiogroup', { name: `${c.word}: similar or opposite` });
      await user.click(group.querySelector(`button:nth-child(${c.bin === 'similar' ? 1 : 2})`)!);
    }
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(reports[0].result).toBe('correct');
  });

  it('Word Maze: a dead end costs the word once, then the maze continues', async () => {
    const ids = ['apple-n', 'river-n', 'salary-n'];
    const { q, reports, doneCalls, user } = setup('word-maze', ids);
    const rooms = (q as { rooms: { target: { id: string; word: string }; doors: { id: string; word: string }[] }[] }).rooms;
    const wrong = rooms[0].doors.find((d) => d.id !== rooms[0].target.id)!;
    await user.click(screen.getByRole('button', { name: wrong.word }));
    await user.click(screen.getByRole('button', { name: rooms[0].target.word }));
    for (const r of rooms.slice(1)) await user.click(screen.getByRole('button', { name: r.target.word }));
    expect(reports.map((r) => r.result)).toEqual(['wrong', 'correct', 'correct']);
    expect(doneCalls.n).toBe(1);
  });

  it('Memory Flip: perfect play is correct; a mismatch after seeing the partner is a miss', () => {
    vi.useFakeTimers();
    const ids = ['apple-n', 'river-n', 'salary-n'];
    const { q, reports } = setup('memory-flip', ids);
    const cards = (q as { cards: { id: string; pairId: string; face: string }[] }).cards;
    const el = () => [...document.querySelectorAll<HTMLButtonElement>('.memory-card')];
    const at = (pair: string, face: string) => cards.findIndex((c) => c.pairId === pair && c.face === face);
    const flip = (i: number) => act(() => el()[i].click());
    // apple: see apple's meaning together with river's word (nothing seen before → no miss)
    flip(at('apple-n', 'meaning'));
    flip(at('river-n', 'word'));
    act(() => vi.advanceTimersByTime(1000));
    // now flip apple's word with salary's meaning: apple's meaning WAS seen → apple missed
    flip(at('apple-n', 'word'));
    flip(at('salary-n', 'meaning'));
    act(() => vi.advanceTimersByTime(1000));
    for (const id of ids) {
      flip(at(id, 'word'));
      flip(at(id, 'meaning'));
    }
    vi.useRealTimers();
    expect(reports.map((r) => [r.vocabId, r.result])).toEqual([
      ['apple-n', 'wrong'], ['river-n', 'correct'], ['salary-n', 'correct'],
    ]);
  });

  it('Time Attack in practice mode has no timer and grades every item', async () => {
    const ids = WORDS.slice(0, 4).map((w) => w.id);
    const { q, reports, doneCalls, user } = setup('time-attack', ids);
    expect(screen.queryByRole('timer')).toBeNull();
    for (const it of (q as { items: { isTrue: boolean }[] }).items) {
      await user.click(screen.getByRole('button', { name: it.isTrue ? /True/ : /False/ }));
    }
    expect(reports.map((r) => r.result)).toEqual(['correct', 'correct', 'correct', 'correct']);
    expect(doneCalls.n).toBe(1);
  });

  it('Time Attack with timers: expiry leaves unanswered words ungraded', async () => {
    vi.useFakeTimers();
    const ids = WORDS.slice(0, 4).map((w) => w.id);
    const { reports, doneCalls } = setup('time-attack', ids, { runtime: { timersEnabled: true } });
    act(() => screen.getByRole('button', { name: /Start/ }).click());
    act(() => vi.advanceTimersByTime(31_000));
    expect(doneCalls.n).toBe(1);
    expect(reports).toEqual([]);
    vi.useRealTimers();
  });

  it('Boss Battle: winning unlocks the boss achievement', async () => {
    const ids = ['apple-n', 'river-n', 'salary-n'];
    const { q, reports, runtime, user } = setup('boss-battle', ids);
    const chs = (q as { challenges: { kind: string; target: { id: string; word: string; meaningsVi: string[] } }[] }).challenges;
    for (let k = 0; k < chs.length; k++) {
      const c = chs[k];
      if (c.kind === 'spell') await user.type(screen.getByLabelText('English spelling'), `${c.target.word}{Enter}`);
      else if (c.kind === 'context') await user.click(screen.getByRole('button', { name: c.target.word }));
      else await user.click(screen.getByRole('button', { name: new RegExp(c.target.meaningsVi.join(', ')) }));
      await user.click(screen.getByRole('button', { name: /Next attack|Finish/ }));
    }
    expect(reports.every((r) => r.result === 'correct')).toBe(true);
    expect(runtime.onAchievement).toHaveBeenCalledWith('boss-slayer');
    expect(screen.getByText(/Victory!/)).toBeInTheDocument();
  });

  it('Ultimate Challenge: failing stage 1 ends the run as wrong', async () => {
    const { reports, doneCalls, user } = setup('ultimate-challenge', ['decide-v']);
    await user.type(screen.getByLabelText('English spelling'), 'desside{Enter}');
    expect(reports).toHaveLength(1);
    expect(reports[0].result).toBe('wrong');
    expect(doneCalls.n).toBe(1);
  });

  it('Flash Recall: self-grade "almost" maps to unsure', async () => {
    const { reports, user } = setup('flash-recall', ['apple-n']);
    await user.keyboard(' ');
    await user.click(screen.getByRole('button', { name: /Almost/ }));
    expect(reports[0].result).toBe('unsure');
  });

  it('Listen & Type plays audio automatically and accepts the word', async () => {
    const { reports, runtime, user } = setup('listen-type', ['river-n']);
    expect(runtime.speak).toHaveBeenCalledWith('river');
    await user.type(screen.getByLabelText('Word you heard'), 'River{Enter}');
    expect(reports[0].result).toBe('correct');
  });
});
