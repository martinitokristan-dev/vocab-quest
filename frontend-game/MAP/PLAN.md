# Implementation Plan: Code-Rendered Voxel World Map (3 kingdoms x 45 levels)

Authoritative inputs: `C:\Users\marti\vocab-game\.agents\tasks\map-rebuild\DESIGN.md` (rev. pass 4, follow it; section numbers below refer to it), `REQUIREMENTS.md` (AC-n), `setup-note.md`.
Visual target (comparison only, never a runtime layer, never modified): `C:\Users\marti\vocab-game\frontend-game\MAP\reference\vocab-quest-map.png` (1774x887, 13 nodes).
Root of all new work: `C:\Users\marti\vocab-game\frontend-game\MAP\` (called `MAP\`). Project root: `C:\Users\marti\vocab-game\frontend-game\` (called `FG\`).

## Ground rules (apply to every step)

- Stack: Vite 8 + TypeScript 6 (strict flags: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`; no `enum`, no parameter properties). Canvas 2D only, no Phaser, no new runtime dependency. Existing scripts in `FG\package.json`: `dev`, `build` (`tsc && vite build`), `preview`. Windows + cmd shell: run commands with `cwd = FG\`.
- Never edit: `FG\src\game2d.ts`, `FG\public\assets\*` (do not delete `vocab-map.png`, do not restore PNGs), `MAP\reference\vocab-quest-map.png`, anything under `C:\Users\marti\vocab-game\backend\` or `frontend-portal\`. No `git commit`, no push. Repo base is commit 1981caa.
- Import boundary: only `MAP\src\index.ts` may import from `FG\src\` (`..\..\src\game2d`, `..\..\src\soundManager`). Voxel code never references the strings `vocab-map.png` / `vocab-quest-map.png`; only `MAP\demo\` compare mode may load the reference.
- Every step ends with a green `npm run build` (in `FG\`) once step 1 has added MAP to the tsconfig include, plus `npm run map:test` once it exists.
- Every visual step owes browser evidence: Playwright (driven through installed Edge, `channel: 'msedge'`, no browser download) screenshots saved to `MAP\reference\compare\` named `<step>-<state>.png`, viewed and judged against the reference; record findings in `MAP\tools\check-checklist.md`.
- Deterministic generation only (`mulberry32`, no `Math.random`/`Date.now` in generation).

## Milestone A: foundation (pure logic, data, tooling)

- [ ] 1. Tooling and build graph.
      Install pinned devDependencies with `npm install -D --save-exact vitest @types/node playwright` (pick versions compatible with Vite 8 / current Node; report a blocker instead of switching runners). Edit `FG\tsconfig.json` include to `["src", "MAP/src", "MAP/data", "MAP/demo/main.ts"]`. Add scripts `map:demo`, `map:test`, `map:nodes` (exact commands in DESIGN 19.2 item 6). Create `MAP\tsconfig.tools.json` (extends `..\tsconfig.json`, `types: ["vite/client","node"]`, includes `MAP/tests`, `MAP/tools`, `MAP/src`, `MAP/data`), `MAP\vitest.config.mjs`, and a placeholder `MAP\src\index.ts` (`export {}`) so tsc has input.
      Files: `FG\package.json`, `FG\package-lock.json`, `FG\tsconfig.json`, `MAP\tsconfig.tools.json`, `MAP\vitest.config.mjs`, `MAP\src\index.ts`
      Verify: `npm run build` passes; `npx vitest run --config MAP/vitest.config.mjs --passWithNoTests` exits 0.

- [ ] 2. Core pure modules and API types (no DOM). Depends on 1.
      `core\rng.ts` (mulberry32, hash), `core\math.ts`, `core\quality.ts` (copy thresholds of `detectDeviceCapabilities` from `FG\src\game2d.ts`, do not import it), `core\camera.ts` (`clampToWorld`, `fitZoom`, `minZoom` = max(fit, 0.46), `zoomAround`, `smoothDamp`, `glideDuration`, follow target `cy = avatar.y - 0.12*vh/zoom`), `core\status.ts` (`deriveStatuses` per DESIGN 3.5 incl. availability and unavailable-current case, `globalLevelNumber`), `api\types.ts` (`MapRenderer`, `MapSoundHooks`, `MapEvents`, `NodeRecord`, `NodeState`, `KingdomId`, `StarHistoryItem`, `MapFlowOptions`; re-read `FG\src\game2d.ts` lines ~560-900 first, actual signatures win).
      Tests: `MAP\tests\rng.test.ts`, `camera.test.ts` (avatar y 5000, vh 800, zoom 1 -> cy 4904; zoom 0.5 -> 4808; per-frame glide step < 25% viewport; clamp; anchor-fixed zoom), `status.test.ts` (135 combos, `{1:5,2:5,3:5}` + K2 L1 row, stars default 3).
      Verify: `npm run map:test` and `npm run build` pass.

- [ ] 3. World data, node generator, gates, walk paths. Depends on 2.
      `data\world.ts` (constants WORLD_W 1774, SEG_H 887, 7 segments, KINGDOMS, `GateRecord`/`EntranceRecord` types), `data\spines.ts` (K2/K3 waypoints, K1 anchors L1-13 incl. L9 nudged to (1266,364), K1 boardwalk legs, pins L17=A(1245,496) L18=B(1196,304); re-measure anchors on the reference within +/-4 px, confirm image-to-path by byte size 3,012,642), `data\scenes\k1.ts` exporting only `K1_S1_FOOTPRINTS` for now, `core\layout.ts` (spine -> equal-arc nodes between pins, `validateNodes`, `nearestNode`, `segmentForY`), `tools\generate-nodes.ts`, `data\nodes.ts` + `data\gates.ts` (generated, committed; `npm run map:nodes` rewrites them), `core\walkPath.ts` (`computeWalkPath`, `walkPlan` with 900-unit rule and `warpAfterIndex`). Apply the adjustment rule of DESIGN 3.3 until spacing 90-200 (bridge hops L3-L4, L8-L9 tagged and allowed up to 250) and clearances hold.
      Tests: `nodes.test.ts` (AC1-3, determinism via regen compare, K1 corridor/pin/polyline checks, footprint clearance >= 60), `gates.test.ts`, `walkpath.test.ts` (135x135 < 100 ms, max segment 60), `walkplan.test.ts`.
      Verify: `npm run map:test` passes; `npm run build` passes.

- [ ] 4. Flow layer and guard tests. Depends on 2, 3.
      `src\flow\flowMode.ts` (lazy `resolveRequestedMode()`, `getFlowMode`, `setFlowMode`; order: sessionStorage `vq_map_voxel_failed` -> URL `?map=` -> localStorage `vq_map_renderer` -> `VITE_MAP_RENDERER` -> default `'voxel'`), `src\flow\kingdomMap.ts` (`kingdomIdOf`, `kingdomByMapId`, `rememberMap`), `src\flow\flowAdapter.ts` (`getStepRef`, `globalLevelNumber = (k-1)*45+q`, level 46 -> null, `computeWalkPath`, transition path via `walkPlan`).
      Tests: `flow.test.ts`, `flowMode.test.ts` (`vi.resetModules()` between cases), `kingdomMap.test.ts` (ids {11,12,13}, unknown 99 skipped, unknown 2 falls back), `importBoundary.test.ts`, `noRefAssets.test.ts`, `types.test-d.ts` (`Game2DMapRenderer satisfies MapRenderer`, compiled by `tsc -p MAP/tsconfig.tools.json --noEmit`).
      Verify: `npm run map:test` and `npm run build` pass.

## Milestone B: rendering engine, demo shell, performance gate (milestone 0)

- [ ] 5. Voxel rasteriser and materials. Depends on 2.
      `raster\voxelRaster.ts` (`rasterizeVoxelModel`, exposed-face culling, lighting rules DESIGN 2.3: top +14%, 2-unit left highlight, right shadow, 1-unit outline, +/-5% seeded noise), `raster\materials.ts` (kingdom palettes, grass/dirt/stone/cobble/water), `raster\spriteCache.ts`, `raster\text.ts` (canvas text with MinecraftTen then Quicksand fallback, re-raster on `document.fonts.ready`), `raster\flagSprite.ts` (Philippine and yellow flags from geometry), model type in `data\models\types.ts`, one smoke model `data\models\props.ts` (cube tree).
      Tests: `raster.test.ts` (exposed-face counting with a canvas stub).
      Verify: `npm run map:test`; `npm run build`.

- [ ] 6. Generation and bake pipeline. Depends on 3, 5.
      `gen\heightfield.ts`, `gen\carve.ts`, `gen\scatter.ts`, `gen\segmentScene.ts` (world-space noise, path flatten PATH_HALF_W 26, PATH_CLEAR 70, bleed 64), K1 S1 far-field row generator with `s(refY)` curve (DESIGN 2.3), `render\bakeBudget.ts` (pure), `render\bake.ts` + `render\bakeQueue.ts` (row-sliced 12 ms ticks, OffscreenCanvas fallback, placeholder 1/8 scale, LRU, never evict visible, retry at 0.75).
      Tests: `farfield.test.ts`, `bakeBudget.test.ts` (six viewports incl. 390x844: visibleMax 4, maxBaked 6, scale 1.5), seamless-noise test (two neighbouring segments sample identical values on the shared edge).
      Verify: `npm run map:test`; `npm run build`.

- [ ] 7. `VoxelWorldMap` core, input, HUD skeleton. Depends on 4, 6.
      `VoxelWorldMap.ts` (constructor signature = game2d's + `hooks?`; layer stack DESIGN 2.2; DPR `min(dpr,2)` / 1 on low; ResizeObserver; visibility/IntersectionObserver pause; dt clamp 50 ms; idempotent `remount`/`destroy`; context-loss handling; stub procedural scenes for all 21 segments so the whole world scrolls), `render\frame.ts`, `render\layers\{sky,objects,nodes,overlays}.ts`, `input\pointer.ts` (drag threshold 5 px, inertia, wheel pan, ctrl-wheel zoom, pinch), `input\keyboard.ts`, `hud\hud.ts`, `hud\hud.css`, `hud\icons.ts` (recenter icon, no emojis). Camera follow, glide and warp per DESIGN 5.2.
      Verify: `npm run build`; `npm run map:test`; open the demo (step 8) and confirm the stub world scrolls with no hairline seams.

- [ ] 8. Demo shell and milestone-0 performance spike. Depends on 7.
      `demo\index.html`, `demo\main.ts` (relative imports only), `demo\demo.css`, `demo\vite.config.mjs` (root `MAP/demo`, `server.fs.allow` parent, `publicDir` `../../public`), basic panel (FPS/draw ms/baked MB from `getStats()`), `?compare=1` mode skeleton (1774x887, DPR 1, overlay slider of the reference, dev only). `tools\perf.mjs` (Playwright + CDP `Emulation.setCPUThrottlingRate` 4) writes `MAP\tools\perf-report.md`.
      Gate (DESIGN 9.2, AC20): 1366x768, camera at K1 L20 (3 segments visible): unthrottled frame work <= 4.5 ms; at 4x throttle >= 55 fps on `medium` and >= 30 fps on `low`. If it fails, stop and fix the engine (smaller bake scale, fewer dynamic sprites) before FEAT-003.
      Verify: `npm run map:demo` serves; `node MAP/tools/perf.mjs` (plain ESM Playwright script against the running demo) prints the three numbers; `npm run build` passes.

## Milestone C: Kingdom 1 opening segment fidelity gate

- [ ] 9. Voxel models for the reference landmarks. Depends on 5.
      `data\models\school.ts`, `sign.ts` + `letters.ts` (I, heart, E, P, C, E, S, WELCOME), `hall.ts`, `capitol.ts`, `props.ts` (playground towers/slides, lamp post, white van, red car, dark SUV, fence, wooden bridge, bush, flowering bushes x3, oak x3, hill pyramid, rock, lily pad, waterfall step), `tools\export-atlas.mjs` (Playwright against demo route `?atlas=1`) writing `MAP\reference\compare\atlas\*.png` (QA only). Sign text via canvas text, not copied bitmaps.
      Verify: `npm run map:test`; view atlas PNGs and compare each sprite with its reference crop; `npm run build`.

- [ ] 10. K1 S1 hand-placed scene and fidelity gate. Depends on 6, 8, 9.
      Complete `data\scenes\k1.ts` S1: hand-placed ~120 objects (trees, bushes, flowers, hills, rivers, waterfalls, lily pads, banks, fences) from reference measurements, scatter disabled; landmarks at reference positions (re-measure footprints within +/-6 px and commit as `K1_S1_FOOTPRINTS`); path/boardwalk exit with plank pad at the L8-L9 crossing; top 130 px ground instead of sky with two near clouds; nodes 1-13 at anchors. Create `tools\reference-boxes.json` (11 table landmarks + 4 waterfalls + 2 yellow flags + Philippine flag), `tools\compare.mjs` (48x48 blocks, CIELAB deltaE76), `tools\check-checklist.md` (28 items scored 0-2).
      Gate (DESIGN 14.0; loop until it passes, then record numbers in README): every box edge within 24 units, nodes 1-13 within 12; >= 75% of blocks deltaE76 < 14 and mean < 12; items 3-28 scored, all landmark items (14-26) = 2, total >= 50/56; perspective band reads as receding. Judge by viewing side-by-side screenshots yourself, not by metrics alone.
      Verify: `?compare=1` screenshot at 1774x887 vs reference; `node`/Playwright compare run prints PASS; `npm run map:test`; `npm run build`.

## Milestone D: the rest of the world

- [ ] 11. Kingdom 1 segments S2-S7 and the K1 top gate. Depends on 10.
      Fill `data\scenes\k1.ts` S2-S7 per DESIGN 3.1 (garden terraces and bridge, playground meadow and waterfall cascade, hills, river valley with long bridge, orchard terraces with second waterfall chain, gate plateau), sky gate zone (u > 5879: gradient sky, >= 6 large block clouds, hills of 12-unit cubes), `render\layers\clouds.ts` placement helper `cloudField(k)`, gate arch model at `GateRecord` position, boardwalk legs inside the spine. Score checklist items 1-2 on K1 S7 / K1-K2 boundary.
      Verify: Playwright screenshots K1 L20, K1 L45 + gate (no gaps, seams or margins); `npm run map:test`; `npm run build`.

- [ ] 12. Kingdom 2 (Bayan ng Prosperidad). Depends on 11.
      `data\models\k2-*.ts` (town arch, market stall, fountain, banner string, bench, stone bridge, pier, colosseum hero at 1.4x, palms/acacia, reed, boat), `data\scenes\k2.ts` S1-S7 incl. cloud-stairs arrival zone (u < 330), warm tan/teal palette, mesas, top gate; entrance arch with 320x200 hit rect per `EntranceRecord`.
      Verify: screenshots K2 L1 and K2 L45 + gate and K1/K2 boundary seam; `npm run map:test`; `npm run build`.

- [ ] 13. Kingdom 3 (Provincial Capitol). Depends on 12.
      `data\models\k3-*.ts` (capitol arch, colonnade bay, terrace wall, cypress, obelisk, vehicle re-skins, cliff edge, belvedere, grand capitol 1.6x with flags, statue), `data\scenes\k3.ts` S1-S7 (no gate, finale steps), cool green palette, conical peaks.
      Verify: screenshots K3 L1, K3 L45 finale, K2/K3 boundary; walk the whole world top to bottom in the demo and read `bakedSegments`/`bakedMB` (<= `maxBaked`, < 150 MB, AC21); `npm run build`.

## Milestone E: effects, behaviour, accessibility, full demo

- [ ] 14. Animated effects and node visuals. Depends on 13.
      `render\layers\{water,clouds,nodes,avatar}.ts` and dynamic objects: water shimmer pattern + waterfalls with mist, two cloud layers, waving flags (12 slices), tree/bush sway, lamp and window glow, node sparkles (pooled), hover glow, pulsing current node + bouncing arrow, completed emerald outline with 1-3 candy stars (port the star drawing from `game2d.ts`), locked dim with lock glyph, "coming soon" dashed outline, ambient sparkles and sun glow, adaptive governor (EMA 22 ms down / 12 ms up once). Quality tiers H/M/L per DESIGN 8. World clock frozen when reduced motion.
      Verify: Playwright 3 s capture: pixel diff shows changes in water, falls, flags, canopies, clouds; with `reducedMotion: 'reduce'` frames identical (AC13); `npm run map:test`; `npm run build`.

- [ ] 15. Avatar, walking, camera sequences, kingdom flow. Depends on 14.
      Avatar walk (speed clamp(len/4,150,400), foot cycle, bounce, flip, dust, `hooks.step` rate-limited 6/s, token-guarded `onArrival`), `walkPlan` warp, glide/warp camera, recenter (`Home`), `setProgress`/`updateProgress` diff, `setAvailability`, gating table DESIGN 5.4, entrance hit rects, mist + 3D padlock, `playKingdomEntryAnimation` (1.5 s) and `animatePadlockUnlock` (850 ms) returning promises, gate doors + banner (2.5 s) + camera travel (2800 ms) + re-spawn at next entrance, K3 finale, input lock via try/finally. Events fire once per interaction (`on()` plus legacy `onStepClick/onKingdomClick/onLockedKingdomClick`).
      Tests: extend `camera.test.ts`/`flow.test.ts` as needed. Verify: Playwright runs of AC15, 16, 18, 19 (complete level 45 in K1 and K2, banner visible 2-3 s, input unlocked after); `npm run map:test`; `npm run build`.

- [ ] 16. Accessibility, reduced motion, responsive. Depends on 15.
      `hud\a11y.ts` (<= 24 `button.vq-node-proxy`, `aria-label` per DESIGN 11, live region throttled 1 s), `hud\banner.ts`, progress chip, kingdom mini-indicator, tooltip, recenter emphasis, safe-area insets, `setReducedMotion('auto')`, `matchMedia` listener, DPR change handling.
      Verify: Playwright at 1920x1080 -> 390x844 keeps artwork unstretched and current node visible (AC12); DPR 2 screenshot crisp (AC11); keyboard-only recenter works (AC18); `npm run build`.

- [ ] 17. Complete demo controls. Depends on 15, 16.
      Finish `demo\main.ts`/`demo.css`: kingdom/level pickers + Jump, Complete level (random 1-3 stars, same flow as production via `flowAdapter`), Reset, Recenter, reduced-motion toggle, quality select, availability slider, 135-node debug overlay, avatar picker, FPS/draw/baked readout. Shows validation error panel if `validateNodes()` throws.
      Verify: Playwright drives the demo through K1 L1 -> L45 -> K2 and checks FR-34 controls; `npm run build`.

## Milestone F: wiring, documentation, full verification

- [x] 18. Factory and minimal wiring outside MAP. Depends on 4, 15.
      `MAP\src\index.ts` (`createMapRenderer` -> `{renderer, mode}`, `isVoxelMapEnabled`, hooks mapped to `soundManager.playHover/playClick/playWrong/playStep/playSuccess/playWhoosh/playPadlockUnlock`, try/catch fallback to `Game2DMapRenderer`, sets `sessionStorage.vq_map_voxel_failed`, `setFlowMode`). Edit exactly these files: `FG\src\components\screens\WorldMapScreen.ts` (lines ~3, 14, 17-18, 133), `FG\src\main.ts` (lines 3, 64; `kingdomIdOf` at the `map.id` sites near 666, 921, 1094, 1489, 1569, 1655, 1704, 1779, 1829; `kingdomByMapId` for the filters near 991, 1709; `rememberMap` on each question response; `setAvailability`; keep raw `map.id` compare near 644; re-grep for `map?.id|map.id` first), `FG\src\mapFlowController.ts` (delete `STEP_COORDS`, `MAP_OFFSETS`, `KINGDOM_TRANSITION_PATHS`, modulo; delegate to `flowAdapter` per `getFlowMode()` at call time; legacy table kept for PNG mode, `q <= 5`), `FG\src\dialogueData.ts` ("levels 1 to 45"), `FG\src\utils\teacherAnimation.ts` (~72) and `FG\src\components\screens\QuestionScreen.ts` (~70) theme selection via `kingdomIdOf`.
      Verify: `npm run build` passes (0 errors); `npm run map:test` passes; with `?map=png` the old renderer still works (build + manual load).

- [x] 19. (done except real-game smoke and AC20 4x-medium re-confirmation, see README "Not verified") Full browser verification and documentation. Depends on 18, 17.
      Run the Playwright suite in `MAP\tools\verify.mjs` for AC8-AC22 (screenshots K1 L1/L20/L45+gate, K2 L1/L45+gate, K3 L1/L45; network log proves no PNG request, AC9; 4x throttle fps, AC20; baked MB, AC21; reduced motion, AC22). Real-game smoke (AC23) if backend is runnable (PIN 123456): map displays, kingdom click -> padlock -> dialogue -> question, correct answer -> star burst -> walk, refresh keeps position; otherwise state that it could not be verified. Write `MAP\README.md`: purpose, `npm run map:demo`, API, data format, regenerate nodes/atlas, perf and fidelity numbers, the exact list of files touched outside MAP, backend follow-ups (REQUIREMENTS section 8, items 1-11), limitations (K1 S1 is not the full reference frame because the 130 px sky band is ground; top 180 units of K1 S1 flatter than the reference; terrain soft above 1.5x zoom; residual `kingdomByMapId` limit). Update PLAN.md checkboxes. Do not create other markdown files.
      Verify: all listed screenshots exist in `MAP\reference\compare\`; README states each measured number.

- [x] 20. Final gate. Depends on 19.
      From `FG\`: `npm run build` and `npm run map:test` green; `git -C C:\Users\marti\vocab-game status --short` shows changes only under `frontend-game\MAP\`, the files listed in step 18, `package.json`, `package-lock.json`, `tsconfig.json`, and `.agents\`; no `backend\` change; `public\assets\vocab-map.png` present and unmodified; `MAP\reference\vocab-quest-map.png` unmodified (size 3,012,642); delete temporary files (perf traces, scratch scripts); no commit made.
      Verify: the commands above.
