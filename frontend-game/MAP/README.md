# Voxel World Map (3 kingdoms x 45 levels)

A map rendered entirely in code (Canvas 2D, TypeScript, no map PNG at runtime) that replaces the static `vocab-map.png`.
The world is 1774 x 18627 units: 3 kingdoms x 7 segments x 45 levels (135 nodes). The player climbs upward, the camera follows,
and after the last level the avatar walks to the kingdom's top gate, a banner shows and the camera travels to the next kingdom.
Visual target (comparison only, never loaded by `src`): `MAP/reference/vocab-quest-map.png`.

## Run

Run from `frontend-game\`:

| Command | What it does |
|---|---|
| `npm run map:demo` | Standalone demo on http://localhost:5199 (kingdom/level pickers, Complete level, Reset, quality, reduced motion, debug overlay). Query: `?k=2&l=10&active=2&quality=low&reduced=1&compare=1&atlas=1` |
| `npm run map:test` | `tsc -p MAP/tsconfig.tools.json --noEmit` then vitest (`MAP/tests`) |
| `npm run map:nodes` | Regenerates `MAP/data/nodes.ts` and `MAP/data/gates.ts` (a test fails if they drift) |
| `node MAP/tools/perf.mjs` | Milestone-0 performance gate against a running demo, writes `tools/perf-report.md` |
| `node MAP/tools/verify.mjs` | Full browser run (screenshots, no-PNG network log, 4x throttle fps, baked MB, reduced motion), writes `tools/verify-report.json` and `reference/compare/verify-*.png` |
| `node MAP/tools/compare.mjs`, `check-effects.mjs`, `export-atlas.mjs` | Fidelity compare, effect checks, sprite atlas export |

The playwright tools drive the installed Microsoft Edge (`channel: 'msedge'`), nothing is downloaded.

## Switching renderers

`createMapRenderer(...)` in `MAP/src/index.ts` has the same arguments as the old `Game2DMapRenderer` constructor and returns `{ renderer, mode }`.
Mode order: `sessionStorage.vq_map_voxel_failed` (set after a construction failure, forces `png`), URL `?map=voxel|png` (also saved in
`localStorage.vq_map_renderer`), that localStorage value, `VITE_MAP_RENDERER`, default `voxel`. If the voxel constructor throws, the factory sets
the session flag and builds the PNG renderer. `MAP/src/flow/flowMode.ts` holds the mode; `mapFlowController` reads it at every call.
`public/assets/vocab-map.png` is untouched and only the PNG fallback loads it.

## API (`MAP/src/api/types.ts`, class `VoxelWorldMap`)

Same surface as `Game2DMapRenderer`: `updateProgress`, `setMapFlowOptions`, `isInputLocked`, `playKingdomEntryAnimation`, `animatePadlockUnlock`,
`clearEntryFade`, `centerOnLocation`, `centerOnKingdom`, `centerOnActiveLocation`, `animateWalkingPath`, `onStepClick`, `onKingdomClick`,
`onLockedKingdomClick`, `remount`, `destroy`. Additions: `setAvailability({1:n,2:n,3:n})` (levels above `total_questions` show "coming soon"),
`on(event, cb)` with `levelClick | kingdomClick | lockedKingdomClick | cameraArrived | walkArrived`, `recenter`, `setQuality`, `setReducedMotion`,
`getStats`. Sound hooks (`hover, click, wrong, step, success, whoosh, padlockUnlock`) are passed in by the factory from `soundManager`.

## Data format

`data/world.ts` (constants, kingdoms), `data/spines.ts` (path waypoints), `data/nodes.ts` (generated, 135 `NodeRecord`s: kingdom, level, globalIndex,
x, y, blockH, segment), `data/gates.ts` (generated top gates and entrances with hit rects), `data/scenes/*` (hand-placed K1 S1 plus scripted K1/K2/K3
segments), `data/models/*` (voxel models). Generation is deterministic (mulberry32, no `Math.random` or `Date.now`).
Only `MAP/src/index.ts` imports from `frontend-game/src` (`game2d`, `soundManager`), enforced by `tests/importBoundary.test.ts`.

## Files touched outside MAP

- `src/components/screens/WorldMapScreen.ts` (factory instead of `new Game2DMapRenderer`, `MapRenderer` type)
- `src/main.ts` (`MapRenderer` type, `kingdomIdOf(map)` at every `map.id` site except the raw DB-change compare, `rememberMap`, `completed_questions` re-keyed by kingdom, `setAvailability`)
- `src/mapFlowController.ts` (voxel mode delegates to `MAP/src/flow/flowAdapter`; legacy PNG table kept for `q <= 5`, modulo removed)
- `src/dialogueData.ts` ("levels 1 to 45")
- `src/utils/teacherAnimation.ts` and `src/components/screens/QuestionScreen.ts` (theme by `kingdomIdOf`)
- `tsconfig.json` (include `MAP/src`, `MAP/data`, `MAP/demo/main.ts`)
- `package.json`, `package-lock.json` (scripts `map:demo|map:test|map:nodes`, pinned devDependencies vitest, @types/node, playwright)

Not touched: `src/game2d.ts`, `public/assets/*`, `backend/`, `frontend-portal/`.

## Measured results

Performance (`tools/perf-report.md`, Edge headless, 1366x768, K1 L20), two sets of numbers on the same code:
- Earlier quiet-machine run (FEAT-002/005): unthrottled frame work 2.64 ms (gate <= 4.5); 4x CPU throttle 60.9 fps medium (gate >= 55) and 68.2 fps low (gate >= 30); seam scan 0 of 119 frames.
- Final run in FEAT-006 (machine also running the game dev server and backend): unthrottled 4.48 ms (PASS, barely); 4x throttle medium 28.2 fps (FAIL, gate >= 55); low 51.9 fps (PASS); seam 0 of 119. `tools/verify.mjs` measured 4x medium 33.6 fps and low 46.7 fps at 1366x768. The medium 4x gate (AC20) is therefore NOT confirmed in the final run; no render code changed between the two runs, so machine load is the likely cause, but this was not proven.
`tools/verify.mjs`: baked max 5 segments and about 40 MB while scrolling the whole world (< 150 MB, AC21); no request for `vocab-map.png` or `vocab-quest-map.png` (AC9); reduced motion 0 changed pixels (AC22); no page errors.
Screenshots (K1 L1/L20/L45/gate, K2 L1/L45/gate, K3 L1/L45): `reference/compare/verify-*.png`.

Fidelity of K1 segment 1 against the reference (`tools/compare.mjs`, `tools/check-checklist.md`): all 18 landmark boxes within tolerance (worst edge delta 18.4 units, nodes 1-13 exact); 41.2% of 48x48 blocks under deltaE76 18 (mean 22.1); checklist 32/52. The originally planned gate (75% of blocks under deltaE76 14, mean < 12, landmark items all 2, total >= 50/56) was relaxed by the product owner, then closed by a time-box and is NOT met. The render is close in layout and palette but not identical.

## Limitations

- K1 S1 is not the full reference frame: the top 130 px sky band is ground, and the top 180 units are flatter than the reference.
- Fidelity gate not met (numbers above): school L-shaped gable roof, tiered hall, capitol portico, tall pyramid hills, wide rivers, saturated lighting and blocky canopies are only approximated.
- Terrain looks soft above 1.5x zoom (baked at a budgeted scale).
- Residual `kingdomByMapId` limit: a completed map that was never the active map in this browser session is only known by its id (fallback to 1..3, otherwise the entry is skipped with one warning) until the backend sends `order_index` with `completed_questions`.
- Possible future phase (not done): the reference's tilted-perspective camera, sky and cloud band at the top of each first screen, and a fully identical look. The current map keeps the near top-down camera and the vertical upward progression; the user decides whether that phase is wanted.
- Visual tuning in this pass (look only, no camera change): brighter K1 greens, richer water blue, warmer roofs and walls, golden brick path with joints, WELCOME sign moved clear of the fence, stepped hill/mesa/peak silhouettes along the side margins of every segment.
- The ~340 added lines in `package-lock.json` are the transitive dependencies of the pinned devDependencies vitest, playwright and @types/node; they are needed by `map:test` and the browser tools. The demo panel and fps overlay exist only in `MAP/demo` and are never mounted by the game.
- Window glow not implemented (lamp glow only); drift clouds have no parallax.
- While the backend serves 5 levels, levels 6-45 are "coming soon" and finishing level 5 walks to the gate (two hops, a warp, then the gate sequence).
- Audio for the kingdom dialogues still says the old level ranges (content task).

## Not verified

- Real-game smoke test (PIN 123456: map shows, kingdom click, padlock, dialogue, question, correct answer, star burst, walk, refresh keeps position) was NOT run end to end; see the step report. `npm run build`, `map:test` and the demo browser runs were.
- `?map=png` fallback was verified by build and code review only, not by a browser load of the full game.
- AC20 at 4x CPU throttle on `medium`: passed once on a quiet machine, failed (28 to 34 fps) in the final runs. Re-run `node MAP/tools/perf.mjs` on a quiet machine before release. `tools/verify.mjs` now reports the median of 5 four-second samples plus min/max. Latest run (game dev server :5173 and backend :8000 running): medium median 28.1 fps (min 24.2, max 29.8; gate 55 and the 45 acceptance floor are NOT met), low median 50.9 fps (min 49.6, max 51.8; PASS). The tight spread means this is a real gap in this environment, not just noise. A CDP profile at 4x throttle (medium) then showed self time dominated by native `drawImage` (about 30 percent) and the browser's own work, with `drawObjects`, `setTransform` and `drawSway` next; water fill, flags and sun glow were each about 1 percent. Look-neutral fixes: `drawSway` draws one blit instead of two when the canopy moves under 0.3 px, and `Sprites.sprite` no longer builds a template-string key per draw. Fresh 4x medium fps on the same machine: before 36.1/49.9/48.5 (median 48.5), after 57.9/46.2/53.7 (median 53.7, profiled run 51.7); run-to-run spread is about 10 fps, so the 55 fps gate is still not reliably met. Candidates to profile next: the per-frame animated water pattern fill (`render/layers/water.ts`), tree sway transforms, and flag slices, which are the animated layers medium draws and low skips. On weak hardware the adaptive governor drops to `low` automatically when real fps falls.
- Smoke test scope: the demo page (`?map` voxel path) mounts with no page errors and no `vocab-map.png`/`vocab-quest-map.png` requests, and the game title screen at :5173 loads with and without `?map=png` with no page errors. The full logged-in in-game click-through (PIN 123456, kingdom click, question, walk, refresh) and the sessionStorage `vq_map_voxel_failed` fallback still need a manual check by the user.

## Backend and portal follow-ups (not implemented, backend is read-only here)

1. Raise the question cap: `backend/app/Http/Controllers/QuestionController.php` `store()` blocks creation at 5 questions (422). Change to 45.
2. Update `backend/tests/Feature/QuestionTest.php` "question creation fails when map already has 5 questions (422)" to 45 and add a 45/46 boundary test.
3. Seeders: `backend/database/seeders/TeacherSeeder.php` seeds 5 questions per map. Extend to 45 per map or document an import path (`maps.question_count` is `tinyint unsigned`, `questions.order_index` is `smallint unsigned`, both fit).
4. `backend/app/Actions/GetRoomResultsAction.php` defaults the map question count to 5; remove that assumption and fix "Q n of 5" progress text.
5. `backend/app/Http/Resources/StudentQuestionResource.php` returns `image_url = null` when `map_id === 2`; key it by `order_index` or a per-question flag.
6. Kingdom identification: the client now prefers `map.order_index`; add `map_order_index` to `completed_questions` so clients need not assume ids 1-3.
7. Docs: `docs/architecture.md` and `docs/rules-and-validation.md` are outdated (3/5/5 questions); update to 45 per map.
8. Teacher portal: `frontend-portal/src/pages/QuestionsPage.tsx` (about lines 256 and 562) hard-codes `questions.length >= 5` and the "maximum of 5 questions" toast; `RoomControlPage.tsx` sorting assumes "question 1 to 15" (check for 135); extend `RoomResultsTest.php`.
9. Performance of `show()`: with 45 per map it loads all questions and answers into cache and queries all correct answers per call. Re-check query cost and `map_questions_{id}` invalidation under 500 polling students; return `completed_questions` only for the active map or paginate.
10. Progress model: add an explicit current global level (`current_level_number`) and keep `total_questions` honest so the client can show "coming soon" nodes.
11. Audio/content: dialogue voiceovers still say levels "1 to 5", "6-10", "11-15"; the text now says "levels 1 to 45", re-record the audio.
