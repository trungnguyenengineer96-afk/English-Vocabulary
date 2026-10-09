# Vocab Quest — Architecture & Plan

## 1. Repository inspection (starting point)

The repository was empty: no commits, no source, no assets, and the remote
had no branches. There were no existing components, datasets or audio files
to reuse, so everything below is new.

The environment provides Node 22, npm, and a preinstalled Chromium for
Playwright 1.56.1.

## 2. Architecture

**Client-only, local-first web app.** It has no backend: all progress lives in the
browser, so the app works offline. Static hosting is enough to deploy it.

| Layer | Choice | Why |
|---|---|---|
| UI | React 19 + TypeScript (strict), Vite | Fast, typed, small runtime; no router/state libs needed |
| Styling | Plain CSS with design tokens (custom properties) | No build-time dependency; easy theming & reduced-motion |
| Domain logic | Pure TS modules in `src/core` | Deterministic, unit-testable, UI-independent |
| Persistence | `localStorage`, single versioned document + migration chain + backups | Synchronous, simple, enough for thousands of words (history is capped per word) |
| Audio | Pre-rendered MP3 clips (Piper neural TTS, `public/audio` + manifest); Web Speech API only as a fallback | Works offline and without an English system voice (e.g. Vietnamese Windows) |
| Randomness | Seeded PRNG (mulberry32) | Reproducible selection & tests |
| Tests | Vitest + Testing Library (jsdom), Playwright e2e | Unit, component and browser coverage |

```
src/
  core/            pure domain logic (no React)
    types.ts       data model
    rng.ts         seeded PRNG + helpers
    dates.ts       local-day helpers
    scheduler.ts   review-state transitions (spaced repetition)
    daily.ts       daily new-word selection
    selection.ts   adaptive review selection (weighted categories)
    scoring.ts     points / XP / combo
    metrics.ts     dashboard metrics (completion, accuracy, mastery)
    library.ts     library ops (add/dedupe/search/filter)
    session.ts     session model + result aggregation
    mixed.ts       Mixed Challenge planner (4 rounds x 5)
    achievements.ts
    storage.ts     versioned persistence, migrations, backup, import/export
  data/
    words.ts       curated vocabulary dataset (hand-authored)
  modes/           30 game modes: pure question builders + React components
  ui/              app shell, screens, shared components
  state/           React store (context) wrapping core + storage
```

## 3. Data model

**Vocabulary entry** (static content; optional fields are omitted when unknown, never guessed):
`id, word, ipa?, pos, meaningsVi[], definitionEn?, example?{en, vi?, form?},
synonyms?, antonyms?, collocations?, family?[{word,pos}], difficulty(1–5≈A1–C1),
frequency(1–5), tags[], syllables?[], stressIndex?, emoji?, confusables?, audio?{url?}`.
For pronunciation, the app generates speech from `word` with TTS. A recorded `audio.url` is used when an entry has one.

**Library item** (per user, keyed by `vocabId`, so the same word cannot be saved twice):
`vocabId, addedAt, source(daily|manual), favorite, state(new|learning|familiar|mastered),
confidence(0–1), ease, intervalDays, reps, lapses, dueAt, lastReviewedAt,
lastSuccessDay, lastMissAt, lastResult, correct/wrong/unsure counts,
history[] (capped at 50: at, mode, skill, result, given?, sessionId)`.

**App document** (`localStorage["vocabquest.state"]`):
`{ schemaVersion, settings, library{}, dailyPlans{date→{goal, vocabIds, learnedIds}},
sessions[] (capped summaries), xp, achievements{}, modeStats{}, activityDays[] }`.

## 4. Deterministic rules (all unit-tested)

**Review transitions** (`scheduler.ts`), one graded answer at a time:
- *wrong*: reps→0, lapses+1 (once per day), ease−0.2 (min 1.3), confidence−0.25, due now, mark miss.
- *unsure / I don't know*: reps→max(0,reps−2), ease−0.1, confidence−0.15, due now, mark miss.
- *correct*: if the word was already credited today **or** is reviewed before it is due,
  confidence+0.05 only (no interval growth). Otherwise reps+1 and the interval becomes
  1 → 3 → round(prev×ease) days. Ease+0.05 (max 2.8), confidence+0.2, and the
  word is due at the start of that local day.
- State is a pure function: no attempts → **New**; reps≥4 ∧ confidence≥0.8 → **Mastered**;
  reps≥2 → **Familiar**; else **Learning**. Mastery therefore needs successes on at least four
  separate, spaced days (earliest: days 0, 1, 4, 12). A single correct answer can never make a word Mastered.

**Adaptive selection** (`selection.ts`): words fall into the first matching category:
mistakes/unsure → due → weak → reinforcement. Each category's share comes from tunable weights
(default 40/30/20/10) using largest-remainder rounding. When a category runs short, the rest
of its share comes from the other categories in priority order. The app never invents words; a
small library just gives a shorter test.

**Daily selection** (`daily.ts`): seeded per date. It excludes words already in the library,
never picks source-list neighbours (|Δindex| ≤ 1) or two entries with the same spelling, and never picks two words
that list each other as synonyms. It caps each topic at ⌈30%⌉ of the goal and fills difficulty
quotas by learner level, weighted by frequency. Constraints are relaxed in a fixed order
(topic cap → adjacency) only when the pool is too small, and the relaxation is reported.
The plan for each date is saved, so a reload shows the same words.

**Scoring** (`scoring.ts`): correct = 10 × mode weight (recognition 1.0, listening 1.2,
production 1.5) × combo multiplier (1 + 0.1×min(combo,10)); a hint halves the points; wrong
answers and "I don't know" score 0. No answer ever takes points away. A completed session adds
20 XP.

**Metrics** (`metrics.ts`), always shown separately:
- completion = answered / total
- session accuracy = correct / graded
- library mastery = mastered / saved

## 5. Game-mode contract

Each mode has a pure `build(targets, ctx, rng)` that returns a question object and an
`isEligible(entry, ctx)` that checks what data the mode needs (example, synonyms, emoji,
syllables, audio). Each mode also has a React component that reports **exactly one graded
result per target word** (correct / wrong / unsure, or skipped when not graded, e.g. a timer
ran out or audio failed). This makes completion and accuracy the same across all 30 modes.

Skills: reading (8), writing (7), listening (7), arcade (8). Modes that need missing data are
not offered for that word. Listening modes are not offered at all when TTS is unavailable.

## 6. Test strategy

- **Unit**: scheduler transition table; selection allocation and fallback; daily constraints
  checked over many seeds; scoring; metrics; storage migrations, corrupted data and dedupe;
  dataset validation (unique ids, examples contain the target form, syllables join to the
  word); each mode builder (answer present, distractors distinct, eligibility).
- **Component**: key modes driven by keyboard and pointer; session flow to results.
- **E2E (Playwright)**: learn daily words → reload keeps the library → review session →
  results → dashboard metrics.

## 7. Milestones

1. **M1 Core**: scaffold, data model, dataset, scheduler, selection, daily, scoring,
   metrics, storage + unit tests.
2. **M2 Loop**: app shell, daily learning, library, adaptive review with a first set of
   modes, results, dashboard, settings, persistence; e2e of the full loop.
3. **M3 Modes**: the remaining modes, up to all 30, with builder tests.
4. **M4 Mixed & polish**: Mixed Challenge (4×5, focus modes), achievements, boss,
   accessibility pass, final verification.

## 8. External dependencies and data sources

- **Vocabulary data**: a hand-authored dataset (no licensed corpus is bundled). It can be
  extended by appending entries; the validator test guards the format.
- **Audio**: the browser's speech synthesis. Quality depends on the voices the OS provides. No
  recorded audio ships with the app.
- **Pictures**: emoji metadata, only on concrete nouns where an emoji depicts the word clearly.
- No network, accounts or server.

## 9. Required vs optional

**Required**: the daily words → library → adaptive review → modes → progress loop,
persistence and migrations, deterministic scheduling, separate metrics, all 30 distinct
modes, Mixed Challenge, a no-timer practice mode, and keyboard and touch support.

**Optional polish**: richer animations, sound effects, recorded audio, cloud sync, import of
external word lists, extra achievements.
