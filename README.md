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

- **Daily words:** choose 7, 10, 20 or 30 per day. Picks are seeded per date. Two words that sit next to each other in the source list, words with the same spelling, and mutual synonyms never land on the same day, and no topic takes more than 30% of the day. Difficulty follows your level, and common words are preferred.
- **Library:** keyed by word id, so a word can never be saved twice. Search folds Vietnamese diacritics. You can filter by state, topic, favourites or due date, sort the list, select words for a manual review, and add words from the word bank.
- **Adaptive review:** 20 distinct words by default. Selection weights are tunable (default 40% mistakes, 30% due, 20% weak, 10% reinforcement). When a category runs short, the other categories fill in. The app never invents words, so a small library gives a shorter test.
- **States:** New → Learning → Familiar → Mastered. Mastered needs 4 spaced successes and 80% confidence. At the earliest that is day 12.
- **Mixed Challenge:** 4 rounds of 5 words, one skill per round, with varied mechanics. Focused Reading, Listening and Writing variants are available. Results show accuracy per skill, new weaknesses and the review queue.
- **Metrics are never mixed:** session completion, session accuracy and library mastery are always shown as separate figures.
- **Audio:** uses the browser's speech synthesis. The 7 listening modes are turned off when no English voice is available.
- **Data safety:** state is stored in a versioned document with migrations. A backup is written before each migration. Corrupt data is kept in a backup key rather than deleted, and data from a newer app version is opened read-only. Two open tabs stay in sync, and progress can be exported or imported as JSON.

### Extending the word bank

Append entries to one of the `src/data/words-*.ts` files. Leave out fields you don't know; modes that need them will skip the word.
`npm test` runs the dataset validator, which checks unique ids, that each example contains the word form, that syllables spell the word, that stress marks are in range, and that each collocation contains the word.
