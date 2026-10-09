# Status report

Last verified on 2026-10-09 with `npm run check` (typecheck plus **184 Vitest tests**, all passing) and
`npm run test:e2e` (**10 Playwright tests**, all passing: 5 specs, each on desktop Chrome and a Pixel 7 viewport).

## Milestones

| Milestone | Commit | Contents |
|---|---|---|
| M1 Core | `63c427e` | Scaffold, data model, 247-word dataset and validator, scheduler, adaptive selection, daily selection, scoring, metrics, versioned storage |
| M2 Loop | `2843f4b` | Mode contract, first 8 modes, planner, session player, feedback and results, all screens, persistence, TTS detection |
| M3 Modes | `65fef0c` | Remaining 22 modes (30 total), seeded play order, builder and interaction tests |
| M4 Mixed & polish | `54f615b` | Mixed Challenge with focus variants, per-skill results, cross-tab safety, accessibility fixes, axe audits |

## PASS (verified by automated tests)

- **Daily words:** goals of 7, 10, 20 and 30 are met across 40 seeds each. No adjacent source entries, duplicate spellings or mutual synonyms appear on one day, and the topic cap holds. Difficulty follows learner level and frequent words are preferred. Plans are stable across reloads. Raising the goal tops the plan up; lowering it keeps already-learned words. When the dataset runs out, the day simply has fewer words. (`daily.test.ts`, `store.test.ts`)
- **Library:** the same vocabulary item cannot be stored twice, including when duplicates are merged on load. Search folds Vietnamese diacritics. Favourite, state, topic and due filters, sorting, and manual review all work. (`library.test.ts`, `storage.test.ts`, e2e)
- **Adaptive review:** 20 distinct words by default. The 40/30/20/10 split is applied exactly (8/6/4/2), weights are tunable, and short categories are filled in priority order. A small library gives a shorter test; no words are invented. Results are deterministic per seed. (`selection.test.ts`)
- **Scheduling:** the transition table is tested. A wrong answer or "I don't know" resets or reduces reps and marks the word as a mistake. Repeated correct answers in one session never reach Mastered; the earliest mastery is day 12. Early reviews earn no credit, and a lapse counts once per day. (`scheduler.test.ts`)
- **30 modes:** names match the brief, in order. Each has a unique component and builder. The skill split is reading 8, writing 7, listening 7, arcade 8. Every mode builds from the bundled dataset, and modes that need data the word lacks skip it. 13 modes have dedicated interaction tests, and all 30 render. (`modes.test.ts`, `modes.ui.test.tsx`)
- **Mixed Challenge:** 20 distinct words in 4 rounds of 5. A mixed run covers all four skills; focused runs stay within their skill. The boss setting is respected, and there is no listening round without audio. Results show accuracy per skill, new weaknesses and the review queue. (`mixed.test.ts`, `e2e/mixed.spec.ts`)
- **Metrics:** session completion, session accuracy and library mastery are computed and displayed separately. The dashboard also shows the due count, weak words, and a 7-day vs previous-7-day comparison. (`metrics.test.ts`, App test)
- **Scoring:** deterministic. Points never go negative, the combo multiplier caps at 2×, hints halve points, and timed modes add a bonus. (`scoring.test.ts`)
- **Persistence:** progress round-trips, corrupt data is backed up rather than deleted, a backup is written before migrating v1 → v2, data from a newer version is opened read-only, damaged items are repaired, save failures are reported, import/export works, and another tab's saves are adopted. (`storage.test.ts`, App tests)
- **No-timer practice mode:** Time Attack runs without a timer and grades every item. With the timer on, expiry leaves unanswered words ungraded. (`modes.ui.test.tsx`)
- **Accessibility:** axe (WCAG 2 A/AA) reports zero violations on every screen, in light and dark mode, on desktop and mobile, and on all 23 modes that run without audio. Keyboard play is covered by tests: number keys, Enter, Space, typing tiles, and focus moving to Next. (`e2e/a11y.spec.ts`, `e2e/modes.spec.ts`)
- **End-to-end loop:** learn → reload → library → adaptive review → results → dashboard, on desktop and mobile. (`e2e/loop.spec.ts`)

- **Desktop shell:** the Electron app loads the built app from disk and keeps progress after it is closed and reopened. This was tested under Xvfb on Linux with the same `electron/main.cjs` the Windows build uses. (`e2e-electron/app.spec.ts`)
- **Windows installer build:** `npm run dist:win` produces `VocabQuest-Setup-0.1.0.exe` (≈91 MB; an NSIS PE32 installer with no build warnings). The app exe has the icon and version info embedded, and `app.asar` contains only `dist/`, `electron/main.cjs`, the icon and `package.json`.

## FAIL

- None known.

## MISSING (not built)

- **Recorded pronunciation audio:** none ships. Speech synthesis is used, and an optional `audio.url` field is supported by the data model and player but unused by the dataset.
- **Pictures:** emoji only, on 37 concrete nouns. There are no photos or illustrations.
- **Vietnamese UI:** labels and instructions are in English. Meanings, translations and some headings are in Vietnamese.
- **Word bank size:** 247 hand-authored words, roughly 25 days at 10 words a day. There is no import of external word lists.
- **Library detail dialog:** has no focus trap. It closes with Escape or the ✕ button.
- **Accounts and sync:** none. Progress lives in this browser; export/import is the way to move it.
- **CI:** no GitHub Actions workflow has been added.

## UNVERIFIED (not testable here)

- **Running the installer on Windows:** no Windows machine is available, so installing, the shortcuts, uninstalling, the SmartScreen prompt and Windows speech voices in the desktop app are untested. The installer is unsigned.

- **Real speech output:** the test browser has no speech voices. The 7 listening modes passed axe audits against the dev server with a forced-availability flag, and their logic is unit-tested with a mocked `speak`, but audible playback, voice quality and timing on real devices have not been checked.
- **Dataset content:** the format is machine-validated, but IPA, Vietnamese meanings and translations, stress positions and collocations were hand-authored and have not been reviewed by a native speaker or linguist.
- **Real devices and browsers:** only Chromium was tested, at desktop and Pixel 7 sizes. iOS Safari and Firefox were not tested.
- **Screen-reader experience:** only automated axe checks were run; nothing was tested manually with NVDA or VoiceOver.
- **Very large histories:** these approach the `localStorage` quota. History is capped at 50 attempts per word and 200 session summaries, but this has not been load-tested.
- **v1 → v2 migration on real user data:** no real v1 data exists, so the migration is tested only with synthetic v1 documents.

## Suggested next steps

1. Have a native speaker review the dataset, then expand the word bank, ideally from a licensed frequency list.
2. Optionally add recorded audio URLs for higher-quality listening, and translate the UI into Vietnamese.
3. Add a CI workflow (typecheck, Vitest, Playwright) and test manually on iOS Safari with VoiceOver.
4. Add a focus trap to the library dialog.
