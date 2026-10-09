# 🧭 Vocab Quest

A gamified English vocabulary app for Vietnamese-speaking learners. The core loop is:

**Daily new words → personal library → adaptive review → 30 mini-games and Mixed Challenge → progress and mastery.**

The app optimises for retention rather than game scores. Every answer, in any mode, feeds one deterministic
spaced-repetition schedule, so mastery has to be earned over several separate, spaced days.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # static site in dist/ (no server needed)
npm run preview
```

## Windows desktop app (.exe)

```bash
npm run dist:win     # → release/VocabQuest-Setup-<version>.exe
```

The app is packaged with Electron. The installer is built by a custom NSIS script (`build/installer.nsi`) and `scripts/build-win.mjs`, so it can be built on Linux without Wine. It installs per user (no administrator rights) to `%LOCALAPPDATA%\Programs\Vocab Quest`, with Vietnamese and English installer screens and Start-menu and desktop shortcuts. It uninstalls from *Settings → Apps*. Learning progress lives in `%APPDATA%\Vocab Quest` and is kept across updates and uninstalls.
The installer is not code-signed, so Windows SmartScreen may show "Windows protected your PC". Click **More info → Run anyway**.

`npm run app` runs the desktop shell locally. `npm run test:electron` launches it and checks that progress survives a restart (use `xvfb-run -a` on headless Linux).

## Test it

```bash
npm run check        # typecheck + unit/component tests (Vitest)
npm run test:e2e     # Playwright: full loop, Mixed Challenge, all modes, axe accessibility audits
```

The e2e suite builds the app and serves it on port 4174. It runs on desktop Chrome and a Pixel 7 viewport.

## What's inside

| Area | Where |
|---|---|
| Architecture, data model, rules | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Milestone status (PASS / FAIL / MISSING / UNVERIFIED) | [`docs/STATUS.md`](docs/STATUS.md) |
| Pure domain logic (scheduler, selection, daily picks, scoring, metrics, storage) | `src/core/` |
| Hand-authored 247-word dataset + validator | `src/data/` |
| 30 game modes (pure builder + React component each) | `src/modes/` |
| Session planning, player, feedback and results | `src/session/` |
| Screens and shared UI | `src/ui/` |

### Key behaviours

- **Learner profiles:** each time the app opens, the learner picks their profile ("Hôm nay ai học nào?") or creates one with a name, an avatar and a colour. Every profile has fully separate progress. Data from the single-user version becomes "Người học 1", and a backup copy is kept.
- **Placement test (bài kiểm tra đầu vào):** a 3-question survey (goals, minutes per day, self-rating) followed by an adaptive test of 12–20 questions across reading, listening and writing. It uses an IRT model with a guessing correction and an EAP ability estimate. The result (A1–C1) sets the difficulty of new words (centred just above the learner's level), favours their topics, sets the daily goal, saves words they already know, and makes reviews favour their weakest skill. Design: [`docs/DESIGN_PROFILES_PLACEMENT_FX.md`](docs/DESIGN_PROFILES_PLACEMENT_FX.md).
- **Learning path and quests:** a 5-stage A1→C1 map with learned/mastered progress and checkpoint tests for each stage, plus a "today's quests" checklist on the dashboard (review, new words, weak-skill game, optional Mixed Challenge).
- **Effects:** sound effects synthesised with Web Audio (tap, correct, wrong, combo, next, fanfare, achievement), with an on/off switch and volume. Visual effects include confetti, combo toasts, a floating "+points", slide-in transitions and an owl mascot that reacts in Vietnamese. All animation respects Reduce motion.

- **Daily words:** choose 7, 10, 20 or 30 per day. Picks are seeded per date. Two words that sit next to each other in the source list, words with the same spelling, and mutual synonyms never land on the same day, and no topic takes more than 30% of the day. Difficulty follows your level, and common words are preferred.
- **Library:** keyed by word id, so a word can never be saved twice. Search folds Vietnamese diacritics. You can filter by state, topic, favourites or due date, sort the list, select words for a manual review, and add words from the word bank.
- **Adaptive review:** 20 distinct words by default. Selection weights are tunable (default 40% mistakes, 30% due, 20% weak, 10% reinforcement). When a category runs short, the other categories fill in. The app never invents words, so a small library gives a shorter test.
- **States:** New → Learning → Familiar → Mastered. Mastered needs 4 spaced successes and 80% confidence. At the earliest that is day 12.
- **Mixed Challenge:** 4 rounds of 5 words, one skill per round, with varied mechanics. Focused Reading, Listening and Writing variants are available. Results show accuracy per skill, new weaknesses and the review queue.
- **Metrics are never mixed:** session completion, session accuracy and library mastery are always shown as separate figures.
- **Audio:** 516 pronunciation clips (every word, commonly confused word and example sentence) ship with the app, so sound works offline and on Windows without an English system voice. The system's English voice is used only for text that has no clip. After changing the dataset, run `npm run audio` (needs [Piper](https://github.com/rhasspy/piper) and `ffmpeg`; set `PIPER_MODEL`) to render new clips; a test fails if any clip is missing.
- **Voice license:** the clips were generated with Piper's *Lessac (medium)* voice, trained on the Blizzard 2013 Lessac dataset, whose license restricts commercial use. That is fine for personal learning; re-render the clips with a commercially licensed voice before selling the app.
- **Data safety:** state is stored in a versioned document with migrations. A backup is written before each migration. Corrupt data is kept in a backup key rather than deleted, and data from a newer app version is opened read-only. Two open tabs stay in sync, and progress can be exported or imported as JSON.

### Extending the word bank

Append entries to one of the `src/data/words-*.ts` files. Leave out fields you don't know; modes that need them will skip the word.
`npm test` runs the dataset validator, which checks unique ids, that each example contains the word form, that syllables spell the word, that stress marks are in range, and that each collocation contains the word.
