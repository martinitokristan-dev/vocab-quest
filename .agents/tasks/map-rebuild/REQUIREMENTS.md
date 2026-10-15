# Vocab Quest: Code-Rendered Voxel World Map. Requirements

Status: requirements only. No code was modified. Backend is read-only for this project.
Baseline: commit `1981caa` (tag v1.2.0, branch `8-19-26-vocab-quest`).

## 1. Summary

The game map is currently one static PNG (`frontend-game/public/assets/vocab-map.png`, 1774x887) with **15 levels = 3 kingdoms x 5 levels**. It will be replaced by a map **rendered entirely in code** (HTML + CSS + JS/TS, canvas and/or SVG/HTML overlay, no map PNG at runtime) that is a tall vertical world with **3 kingdoms x 45 levels = 135 global levels**. The player climbs upward. The camera follows with easing, and after level 45 it travels to the kingdom's top gate and transitions into the next kingdom with a title banner. The art must look **more identical, not less**, to the voxel reference image. All new files live in `c:\Users\marti\vocab-game\frontend-game\MAP`.

Counting convention (confirmed by the user): the current game is 5 levels per kingdom, 15 total. The target is 45 per kingdom, 135 total.

## 2. Step 0 findings: the current game at 1981caa

### 2.1 Stack and structure
- `frontend-game`: Vite 8 + TypeScript 6, `phaser ^4.2.1` listed in package.json. **Phaser is not imported anywhere in `src/`** (verified by search). The dependency is unused. No `vite.config.*` exists. tsconfig is strict-ish (`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `include: ["src"]`). Code outside `src/` (such as `MAP/`) is **not type-checked by `npm run build`** unless included or imported from `src`.
- Single-class app in `src/main.ts` (2275 lines). Screens in `src/components/screens/`. State type in `src/types/state.ts`.
- Stray empty folders `frontend-game/copy` and `frontend-game/dir` exist from an earlier mishap. They are not part of the project (flag for cleanup, do not rely on them). `frontend-game/dist` is a stale build.

### 2.2 How the map is loaded and displayed today
- `src/game2d.ts` (2165 lines), class `Game2DMapRenderer`, **Canvas 2D** with its own `requestAnimationFrame` loop.
- `loadAssets()` creates `new Image()` with `src='/assets/vocab-map.png'` and `decode()`. It is drawn each frame with `ctx.drawImage(mapImg, 0, 0, 1774, 887)` (LAYER 1).
- World constants: `WORLD_WIDTH=1774`, `WORLD_HEIGHT=887`, zoom `minZoom` (fit) to `maxZoom=3.2`. The changelog says 2.8x, but the code says 3.2.
- Canvas is sized `innerWidth x innerHeight`, with **no `devicePixelRatio` handling**, so it is blurry on high-DPI screens. This is a defect to fix.
- Layers per frame: sky gradient (screen space) -> bg clouds -> map PNG -> water-glint sparkles (hard-coded to one river area) -> locked-kingdom dark mist + 3D padlock -> kingdom name plaques -> step nodes -> run dust + avatar -> sparkles -> fg clouds -> screen overlays (vacuum vignette, fade).
- Everything animated is drawn procedurally over the static PNG. Waterfalls, flags and trees inside the PNG do **not** animate today.

### 2.3 Game2D public API consumed by the game
`constructor(container, avatarImgUrl, activeMapId, currentQuestionIndex, customMaps?, initialPlayerPos?, starsHistory?, mapFlowOptions?)`, `updateProgress(activeMapId, qIndex, starsHistory)`, `setMapFlowOptions({activeMapId, enteredKingdomIds, mapPhase})`, `isInputLocked()`, `playKingdomEntryAnimation(kingdomId)`, `animatePadlockUnlock(kingdomId)`, `clearEntryFade()`, `centerOnLocation(x,y)`, `centerOnKingdom(id)`, `centerOnActiveLocation()`, `animateWalkingPath(waypoints, bubbleText, onArrival)`, `onStepClick((mapId, qIndex))`, `onKingdomClick(id)`, `onLockedKingdomClick()`, `remount(container)`, `destroy()`. Exported types: `StarHistoryItem`, `QuestionStepNode`, `BuildingKingdom`.

Consumers: `WorldMapScreen.ts` (creates or updates the renderer in `#canvasContainer`, HUD in DOM: player card with stars, "PROSPERIDAD MAP" pill, MENU button) and `main.ts` (`bindMapCallbacks`, `handleKingdomClick`, `executePendingMapAction`, answer-correct flow).

### 2.4 Node positions today (15 nodes, px on the 1774x887 PNG)
From `game2d.ts` `epcesStations/bayanStations/capitolStations` and `mapFlowController.ts` `STEP_COORDS` (node center, block height in brackets):
- K1 EPCES: (140,780)[66], (287,744)[64], (411,707)[62], (515,662)[60], (616,615)[58]
- K2 Bayan: (720,537), (816,558), (932,566), (1043,560), (1155,536) [58-60]
- K3 Capitol: (1265,366), (1340,405), (1430,440), (1526,465), (1638,484) [54-58]
- Avatar stands at `y - blockH/2 + 10` (`getStepRef`). Node blocks are about 52-60 px wide, with named stations ("EPCES Garden", "Bridge Promenade", ...) used for the hover tooltip and the avatar bubble.
- `KINGDOM_TRANSITION_PATHS` has hard-coded walk waypoints `1->2` and `2->3`.
- Kingdom hit boxes and banners (`kingdoms[]`): EPCES (310,450, 310x210, banner y=265), Bayan (910,390, banner y=240), Capitol (1530,250, banner y=65). Focal points are hard-coded in `centerOnKingdom` and `getActiveFocalPoint`.

### 2.5 Reference images
- Both images are really **1774x887** (2:1), not the 1024x506 stated in the brief. The setup note confirms this. Percent coordinates in the brief are unreliable. Use px or normalized coordinates measured from the actual file.
- `MAP/reference/vocab-quest-map.png` (3,012,642 bytes): the voxel reference. Per the setup note it has **13** numbered pink cubes: 1 (175,775), 2 (352,722), 3 (502,667), 4 (713,540), 5 (808,565), 6 (925,573), 7 (1043,566), 8 (1153,537), 9 (1270,368), 10 (1345,413), 11 (1430,445), 12 (1525,472), 13 (1637,488).
- `public/assets/vocab-map.png` (2,899,229 bytes): the game's current map, with 15 nodes (positions in 2.4). Same scene and landmarks, different node spacing. Both images were viewed. One shows 13 nodes with a wooden bridge between 3 and 4, the other shows 15 nodes. The mapping to file paths follows the setup note and byte sizes. **The implementer must re-confirm by file path before measuring.**
- Scene content to reproduce (both files):
  - Sky: blue gradient to light blue at the horizon, puffy blocky white clouds (about 6 large, many small).
  - Terrain: stepped voxel grass; stepped pyramid hills with cube trees on the horizon; cube trees and bushes with small flowers; stone/gray and dirt stepped banks.
  - Water: blue block-water rivers (visible grid of cubes), waterfalls dropping over stepped banks, lily-pad cubes.
  - Path: winding tan cobblestone/sand path; wooden bridge; wooden fences.
  - Left: green-roof "DepEd East Prosperidad Central Elementary School" building, playground slide and tower, "I (heart) EPCES WELCOME" block-letter sign (colored letters I, E, P, C, E, S plus red heart) on a wooden planter with a green "WELCOME" plaque. The brief's "EPES" is wrong. The sign reads **EPCES**.
  - Center: round colosseum-style "BAYAN NG PROSPERIDAD" building (gold/brown, blue columns, green-roof entrance, steps, lamp post), white van, playground slide.
  - Right: red-roof "PROVINCIAL CAPITOL" with Philippine flag, two yellow flags, white van, red car, dark SUV, courtyard path.
  - Nodes: pink voxel cubes with a white number.

### 2.6 Progress, kingdom and level data flow (frontend)
- Backend `GET /api/game/question` returns `data.map {id, order_index, title, total_questions, current_question_num}`, `data.question {id, order_index, question_type, ...}` and `data.completed_questions [{question_id, map_id, order_index, word, stars}]`. `POST /api/game/answer` returns correctness only. The server advances maps, not the client.
- Frontend treats **`map.id` as the kingdom number (1..3)**. This is fragile because it assumes the DB ids are 1, 2, 3. The response also carries `map.order_index`, which is the true ordering and should be preferred, falling back to `id`.
- `question.order_index` is per-map (1..N within its kingdom). `getStepRef` also tolerates "global" indices through `((q-1) % steps.length)`. That modulo is a latent bug once N = 45 only if a client passes global indices. The new API must use explicit (kingdom, level) and remove the modulo.
- Star history (`StarHistoryItem {mapId, orderIndex|questionIndex, stars}`) drives the candy stars (1 to 3) under completed nodes. Missing history for a completed node defaults to 3 stars.
- Node state is derived in `initLayout`: `current`, `completed` (earlier kingdom, or earlier index in the active kingdom), `locked` (later). There is no "unlocked but not current" state today. Clicking a completed or current node opens its question (history view or live). Locked nodes do nothing.
- Kingdom flow (`mapFlowController.ts` and `main.ts`): `mapPhase` is `awaiting_kingdom_click -> kingdom_enter_anim -> kingdom_active -> walking_to_question -> star_celebration`. Clicking an unlocked, unentered kingdom building plays zoom + 3D padlock unlock + fade, stores `entered_kingdom_<pin>_k<id>` in localStorage, then shows the kingdom dialogue, then the question screen. A locked kingdom shows a toast. After the last question of a kingdom the avatar walks the transition path and the map waits for the next kingdom click ("NEW KINGDOM UNLOCKED!").
- After a correct answer: `showStarBurstOverlay(stars, globalLevel)` shows "LEVEL n COMPLETE!", then the avatar walks `completedStep -> toStep` with bubble "LEVEL n!".
- `globalLevelNumber(mapId, q) = {1:0, 2:5, 3:10}[mapId] + q`.
- Walking: speed 150 px/s along waypoints, camera lerp 0.12 per frame, step sound every 24 px, run-dust particles, foot animation, facing flip, bob. Idle: bob + speech bubble "n. Station name".
- Interaction: mouse drag (5 px threshold), wheel zoom toward cursor (x1.15 / x0.87), touch drag, two-finger pinch, strict boundary clamping (no empty margin), hover tooltips with `soundManager.playHover()`, click sounds, `inputLocked` during animations. Mobile portrait uses a "kingdom fit" scale.
- Device tiers: `detectDeviceCapabilities` sets `animationQuality` high, medium or low (cloud and sparkle counts). The new map must reuse this idea.

### 2.7 Avatar, teacher/guide and dialogue systems (must keep working)
- Avatar: image from `getAvatarBySlug` (`/assets/mascot_girl.png`, `explorer_boy.png`, `scholar_*`, `sporty_girl.png`, ...) drawn about 54x68 px on the node.
- Guide/teacher sprites live in `public/assets/guide/` per `SPRITES_AND_GAMEPLAY_RULES.md` (400x800 canvas, heel line Y=760, head top Y=80, feet X about 195, normalizer `align_teacher_sprites.py`). K1 Teacher Faith (F1-F9), K2 Teacher Gevina (G1-G9), K3 Teacher Yanna (yellow). Dialogue uses Lovely/Annabelle guide images and audio in `public/assets/audio/`. **The map project does not touch these systems**, but dialogue text is level-range specific (see 3.2).
- `GEMINI.md` and the sprite rules require `npm run build` with 0 errors before finishing, and sprite normalization after any sprite change. Generated map sprites must not go in `public/assets/guide/`.

### 2.8 Backend model and resources (read-only)
- `maps`: `teacher_id, order_index (tinyint unsigned), title, published, question_count (tinyint unsigned), background_url, ...`. `questions`: `map_id, order_index (smallint unsigned), question_type, sentence, highlighted_word, ...`. Per-map ordering, so 45 per map fits in column types.
- `AdvanceMapProgressionAction`: next published map with a higher `order_index`; otherwise `is_completed`. It has no hard-coded level count.
- `GameQuestionController::show`: picks the first unanswered question in `current_map_id` (ordered by `order_index`) and returns `current_question_num = order_index`, `total_questions = count`. `answer()` advances the map when none remain.
- Backend assumptions that conflict with 45 levels per kingdom (**follow-ups, section 8**): hard cap of **5 questions per map** in `QuestionController@store` (422), the matching test, seeders with 5 per map, a default of 5 in `GetRoomResultsAction`, and a hard-coded `map_id === 2` image rule in `StudentQuestionResource`.

### 2.9 Every place that assumes 15 levels / 5 per kingdom / the PNG
Frontend (in scope):
| # | Location | Assumption |
|---|----------|-----------|
| F1 | `game2d.ts` `loadAssets` | loads `/assets/vocab-map.png`; draws it at 1774x887 |
| F2 | `game2d.ts` constants | `WORLD_WIDTH/HEIGHT`, one-screen world; clamp assumes a wide world |
| F3 | `game2d.ts` `initLayout` | three hard-coded arrays of 5 stations; `totalQuestions: 5` in `kingdoms[]` |
| F4 | `game2d.ts` kingdoms[], `centerOnKingdom`, `getActiveFocalPoint`, `drawFluidWaterLayer`, `fitCameraToScreen` | hard-coded pixel locations for PNG landmarks |
| F5 | `mapFlowController.ts` | `STEP_COORDS` (5 each), `MAP_OFFSETS {1:0,2:5,3:10}`, `getStepRef` modulo by 5, `KINGDOM_TRANSITION_PATHS`, `buildKingdomTransitionAction` fallback `|| 5`, `getStepRef(toMapId, 1)` |
| F6 | `main.ts` | `globalLevelNumber`/`getStepRef` calls in the answer flow (about lines 1058-1210); `activeMapId = map.id` (assumes ids 1-3); `currentQuestionIndex` fallback chains |
| F7 | `dialogueData.ts` | text "level 1 to 5", "level 6-10", "level 11-15" |
| F8 | `WorldMapScreen.ts` | imports `Game2DMapRenderer`; pill text "PROSPERIDAD MAP"; `#canvasContainer` fixed full-screen |
| F9 | `CompletedScreen.ts` | `totalStars/${maxPossibleStars || 9}`; check the max-stars formula |
| F10 | `docs`/`README.md` | "drag to pan, scroll to zoom", numbered bubbles |
Not related (false positives, leave alone): the loading screen's 15 segments (`LoadingScreen.ts`, `main.ts` `totalSegments`).

Backend and portal (out of scope, documented): see section 8.

## 3. Functional requirements

### 3.1 World model: 3 kingdoms x 45 levels (global index 1-135)
FR-1. Data-driven node schema, one record per level (135 total), stored as data (JSON or TS) in `MAP/data/`:
```
{ kingdom: 1|2|3, level: 1..45, globalIndex: 1..135, x, y, status, label? }
status: 'locked' | 'unlocked' | 'current' | 'completed'
```
`globalIndex = (kingdom-1)*45 + level`. `x, y` are in world units, measured from the top-left of the entire world. Status is computed at runtime from progress, not stored in the data. A node also needs a block height / platform size for avatar standing offset (as `blockH` today).

FR-2. Status derivation: `completed` = earlier in order than the current level; `current` = the one the backend says is next; `unlocked` = reachable and not yet answered (used for the next node only if the product wants a preview; otherwise locked). `locked` = later. Define the rule once in a pure function, unit-testable.

FR-3. Vertical world: kingdoms are stacked vertically with **Kingdom 1 at the bottom and Kingdom 3 at the top**. Within a kingdom, level 1 is at the bottom and level 45 near the top, joined by one continuous winding path. Each kingdom ends with a **top gate/portal** that leads to the next kingdom's start. World width is fixed (aspect-preserving); height is the sum of segments. Node spacing is the same order of magnitude as the reference (about 100-190 world units center to center), so a kingdom is about 7-10 reference-image heights tall. The exact size is a design decision, but no single pre-baked canvas may exceed the GPU limit of 4096 px on a side (tile if needed).

FR-4. Path routing: the path winds left and right (S-curves, switchbacks), crosses water on bridges, and stays readable on a phone in portrait. Nodes must never overlap landmarks or each other (min center distance 90 world units, verified by an automated test).

FR-5. Kingdom 1 (EPCES, easy). Its **opening segment is the voxel reference scene**: levels 1-13 follow the reference's 13 node positions (levels 1-13 of segment 1; see 2.5), keeping the school, welcome sign, playground, Bayan hall, vans and the Capitol visible in the scene exactly as in the reference. Levels 14-45 continue the winding path **upward** through additional segments of the same voxel biome (school grounds, gardens, river valley, hills), ending at a top gate. Assumption: the reference scene's three landmarks stay together in the opening segment because that is how the artwork looks. The kingdom *identities* still follow the game (K1 = EPCES school, K2 = Bayan ng Prosperidad, K3 = Provincial Capitol); see 3.3.

FR-6. Kingdoms 2 and 3 get **distinct themed segments** built from the same voxel vocabulary (same cube size, palette, lighting, outline style):
- K2 "Bayan ng Prosperidad" (medium): municipal town. The colosseum-style hall at the center of a plaza, lake promenade (the existing zone name is "Lake Promenade Plaza"), lamp posts, market stalls, fiesta banners, fountains, more water, stone bridges. The hall is the landmark at the top gate.
- K3 "Provincial Capitol" (hard): highland estate. The red-roof Capitol with flag and yellow flags at the summit, grand colonnade drive, stone terraces, cypress/oak groves, parked vehicles, monuments, coastal cliff (existing zone name "Oakhaven Coastal Estate"). The level-45 end of K3 is the finale (capitol steps).
- Each kingdom uses a slightly different grass and sky tint and hill silhouette so the climb is perceptibly different, but the style matches the reference.

FR-7. Kingdom naming and identity: names, subtitles, zones and colors come from the existing `kingdoms[]` (EPCES Kingdom `#10B981`, Bayan ng Prosperidad `#0284C7`, Provincial Capitol `#F59E0B`). Kingdom titles may be overridden from backend `map.title` as today (`customMaps`).

### 3.2 Camera and navigation
FR-8. Auto follow camera: when the current level changes (including initial load), the camera eases to center the current node using a smooth ease (critically damped or ease-in-out, 600-1200 ms; for the walking follow keep the 0.12-lerp feel). No jumps. Camera clamps to world bounds (no empty margins, same rule as today).
FR-9. Look-around: mouse drag, touch drag with inertia, mouse wheel / trackpad scroll (vertical scroll pans up/down; Ctrl+wheel or pinch zooms), two-finger pinch zoom with the zoom anchored at the pinch midpoint, keyboard arrows/PageUp/PageDown. Zoom range: min = fit-to-width, max about 3.2x (existing). Drag threshold of 5 px separates click from drag (existing behavior).
FR-10. A **"Recenter on current level"** control (button in the DOM overlay, keyboard accessible, with an icon from `src/icons.ts` style, no emojis) returns the camera to the current node with the same easing. It appears (or is emphasized) when the current node is off-screen.
FR-11. Kingdom transition: after level 45 is completed the avatar walks to the kingdom's top gate, the camera follows, the gate/portal opens (animation), a **title banner** ("<Kingdom name>", subtitle, kingdom color) displays for about 2.5 s, and the camera travels up into the next kingdom's start. It must integrate with the existing lock/unlock flow (padlock, `kingdom_active`, dialogue). Input is locked during the sequence and unlocked after.
FR-12. Mobile: portrait phone (about 360-430 px wide) fits the world width, shows at least 3 nodes at once, and tap targets are at least 44 px on screen (hit area may exceed the visual cube, as today's 48-world-unit minimum hit radius).

### 3.3 Visual fidelity (key acceptance criterion)
FR-13. Reproduce every element in 2.5 with the same voxel look: cube grid on terrain and water, stepped hills, cube trees with highlight and shadow faces, flowers, fences, bridge, cobblestone texture, building details (roof tiles, windows, columns, sign text). Text on signs and plaques is rendered as real text or glyph-built voxel letters, not bitmaps copied from the reference.
FR-14. No runtime use of the reference PNG or `vocab-map.png`. The reference is a visual target only and stays in `MAP/reference/`. No texture is cut from it. All art is generated by code or generated vector/pixel assets stored in `MAP/assets/`.
FR-15. Palette, lighting direction (light from upper-left, lighter top faces, darker side faces), cube size (the reference cubes are about 14-22 px at 1774 px width) and saturation match the reference.

### 3.4 Effects (all present in the new map; the PNG could not animate most of them)
FR-16. Animated water: flowing cube-water shimmer and glints on all rivers; animated waterfalls (falling stripes, mist at the base).
FR-17. Drifting clouds (parallax, two layers, wrap-around); on tall worlds clouds appear at the top of each kingdom and also as a slow background layer.
FR-18. Waving flags (Philippine flag and yellow flags) with cloth-wave animation.
FR-19. Swaying trees and bushes (gentle, offset per tree, small amplitude); chimney/lamp glow on the lamp post.
FR-20. Node sparkles on unlocked/current nodes; hover glow (sky-blue outline, existing); pulsing golden outline and bouncing arrow on the current node (existing, 4.5 rad/s pulse); emerald completed outline with 1-3 candy stars (existing, same drawing); locked nodes dimmed with a small lock.
FR-21. State styling: locked (desaturated, dimmed, lock glyph), unlocked, current, completed (stars). Colors compatible with the existing HUD.
FR-22. Avatar walking node to node: keeps the existing behavior (150 px/s equivalent, foot cycle, bounce, facing, dust, step sound, speech bubble), generalized to long paths, with the follow camera. The speed is capped so a 45-node climb never takes over about 6 s per hop sequence. Multi-hop path (for example, resume after a refresh) teleports to the current node, not walks 100 nodes.
FR-23. Kingdom features preserved: kingdom name plaques, locked-kingdom dark mist + 3D padlock + unlock animation (850 ms), zoom-in entry animation (1.5 s), hover sound, click sound, wrong sound on locked, toast callbacks.
FR-24. Ambient: floating sparkle particles, soft sun glow in the sky; counts depend on `animationQuality`.

### 3.5 Component API (fits the existing data flow)
FR-25. A framework-free TypeScript class (suggested name `VoxelWorldMap`, in `MAP/src/`) that exposes the **same public surface as `Game2DMapRenderer`** so `WorldMapScreen`/`main.ts` need only a swap of import and constructor: all methods listed in 2.3. Where signatures need the 45-level concept, keep `(mapId, questionIndex)` with `questionIndex` always the **per-kingdom** level 1-45, plus new helpers.
FR-26. New/extended inputs: `setProgress({ currentKingdom, currentLevel, completedLevels: {kingdom, level, stars}[] })`, `getNodePosition(kingdom, level)`, `getGlobalIndex(kingdom, level)`, `recenter()`, `setReducedMotion(boolean)`, `on('levelClick' | 'kingdomClick' | 'lockedKingdomClick' | 'cameraArrived' | 'walkArrived')`. Events fire exactly once per interaction.
FR-27. The renderer owns the canvas lifecycle (create, `remount(container)`, `destroy()` with listener cleanup, `ResizeObserver` instead of window resize only). Calling `destroy()` stops the RAF loop and releases offscreen canvases.
FR-28. Pure logic is separated from rendering: world layout generation, node data, status derivation, walk-path construction (`computeWalkPath(from, to)` follows the node chain, and for cross-kingdom goes via the gate) and camera math are in modules with no DOM dependency so they can be unit tested.
FR-29. `mapFlowController.ts` integration: replace `STEP_COORDS`, `MAP_OFFSETS`, the modulo in `getStepRef`, `KINGDOM_TRANSITION_PATHS` by calls into the MAP data module; `globalLevelNumber(k, q) = (k-1)*45 + q`. Behavior for 1-5 data (while the backend still serves 5 per kingdom) must still work: the map shows 45 nodes but only the levels the backend has questions for are playable (see FR-30).
FR-30. Variable question counts: `data.map.total_questions` may be anywhere from 1 to 45 (the backend is not changed in this project). Nodes beyond `total_questions` are rendered as locked "coming soon" (dimmed, non-interactive, tooltip explains) and the kingdom gate opens after the last *available* question. The kingdom is not blocked when `total_questions < 45`.
FR-31. Kingdom key: use `map.order_index` (fallback `map.id`) as the kingdom number everywhere on the frontend. Document the change.
FR-32. Dialogue text in `dialogueData.ts` is updated to the new level ranges (K1 levels 1-45, K2 46-90, K3 91-135, or per-kingdom 1-45; choose one wording and apply it to all three). Voice/audio files that speak "1 to 5" cannot be changed here. List them for the content team.
FR-33. HUD (DOM overlay inside `MAP`): a progress chip ("Level 37 / 135", "Kingdom 1: 37/45"), the recenter button, and a kingdom mini-indicator. Existing HUD (player card, MENU) is unchanged. All HUD text uses the Quicksand font like the rest of the game, with at least 16px text.

### 3.6 Demo page (standalone)
FR-34. `MAP/demo/index.html` + entry script, runnable by `npx vite MAP/demo` (or equivalent documented command) without the backend:
- kingdom picker (1-3) and level picker (1-45), jump to any state immediately;
- "Complete level" button: marks current completed (random stars 1-3), triggers star burst-like feedback, walks avatar to the next node, and at level 45 plays the gate and next-kingdom transition;
- "Reset", "Recenter", reduced-motion toggle, quality toggle (high/medium/low), FPS and draw-time readout, 135-node debug overlay toggle, avatar picker.
Everything in the demo uses the same component API as production.

## 4. Non-functional requirements

NFR-1 Performance. Target 60 fps on low-end school devices (for example 4 GB RAM Android Chrome, Chromebook-class CPUs). Requirements:
- Pre-bake static segment layers (terrain, buildings, trees, path) into **offscreen canvases** once per segment; per frame only blit visible segments plus animated overlays.
- **Cull** segments and sprites outside the viewport (plus a margin of 1 viewport height); only segments in view are held as bitmaps (LRU evict beyond 4-5 segments).
- Per-frame work is O(visible objects), not O(135 nodes + all trees). No per-frame allocation in hot paths (reuse arrays and gradients; cache gradients).
- Animated parts (water, flags, tree sway, waterfall) are drawn on a lightweight dynamic layer or through frame-cycled pre-baked frames, with 'low' quality reducing frames and particle counts.
- Budget: first interactive paint of the visible region under 1.5 s on a mid phone; memory for baked bitmaps under 150 MB (compute: bitmap area x 4 bytes, reported in the demo).
- The RAF loop pauses when the tab is hidden and when the map screen is not shown; it resumes without time jumps (clamp `dt` to 50 ms as today).
NFR-2 High-DPI. Canvas backing store = CSS size x `min(devicePixelRatio, 2)` (cap 2 on low tier), CSS size via style; crisp edges for text and cube outlines. Pixel art is drawn with `imageSmoothingEnabled=false` where it is blitted at integer scale and smoothing on for fractional scales only when it improves look. Re-bake or re-scale on DPR change.
NFR-3 Responsive scaling. Aspect-preserving: world width maps to viewport width at the fit zoom; on any aspect (portrait phone, tablet, ultrawide) the artwork is never stretched; no empty margins (clamp), safe-area insets respected for HUD.
NFR-4 Accessibility. `prefers-reduced-motion: reduce` disables water/waterfall/flag/tree/cloud/sparkle animation and replaces camera glides with short (<=150 ms) fades or instant moves, but game logic (walk to next node) still completes. The recenter control and level navigation are keyboard operable (Tab focus on HUD buttons; arrow keys pan; Enter on the focused node activates); canvas has `role="application"` and an `aria-label`; an offscreen live region announces "Level N of 45 in <kingdom>" on change. Contrast of node numbers is at least 4.5:1. Note: this does not constitute WCAG validation (manual assistive-technology testing is still required).
NFR-5 Compatibility. Chrome/Edge/Firefox/Safari current and previous major versions; iOS Safari and Android Chrome; touch + mouse. Works when `OffscreenCanvas` is unavailable (fallback to `document.createElement('canvas')`).
NFR-6 Offline/asset policy. No new runtime network dependencies. Fonts: Quicksand (already loaded) and the existing `MinecraftTen` font from `public/fonts` may be used for sign text. Generated sprites/assets are small (total under 3 MB shipped, versus 2.9 MB for the PNG today) and loaded lazily where possible.
NFR-7 Code quality. TypeScript matching repo settings (strict flags above), no `any` in new public API, no new dependencies unless justified (Phaser 4 is allowed only if the design shows a benefit; an unused dependency does not obligate its use). `npm run build` in `frontend-game` must pass with 0 errors, so `MAP/src` must be included in the build graph (via imports from `src/` and/or a `tsconfig` `include` update) and, if code is outside `src/`, its own type check must be run.
NFR-8 Determinism. All procedural generation is seeded; the same seed gives the same map on every device so screenshots are comparable and tests are stable.
NFR-9 Stability of existing behavior. Kingdom entry, locked state, dialogue, question screen, history viewing, pause, teacher reset (`clearMapFlowProgressForPin`) continue to work unchanged.

## 5. Deliverables (all under `c:\Users\marti\vocab-game\frontend-game\MAP`)
- `README.md`: purpose, how to run the demo, API, data format, how to regenerate assets, performance notes, **the backend follow-up list from section 8**, known limitations.
- `PLAN.md`: architecture, module breakdown, milestones, test plan (produced by the later design step).
- `src/`: renderer, camera, input, layout generator, effects, HUD, flow adapter (TypeScript).
- `data/`: scene definitions and node data for 135 levels (kingdoms, segments, landmarks, node coordinates), plus a generated node schema/validator.
- `assets/`: any generated sprites/tiles (with the generator scripts or a note on how to regenerate).
- `reference/`: keeps `vocab-quest-map.png` untouched; screenshots used for comparison go in `reference/compare/` (not shipped).
- `demo/`: standalone demo entry (FR-34).
- `tests/`: unit tests (see 6).
Files outside `MAP` that must change for integration (minimal and listed in PLAN): `src/game2d.ts` (swap or thin wrapper), `src/mapFlowController.ts`, `src/main.ts` (kingdom key and level numbering), `src/components/screens/WorldMapScreen.ts`, `src/dialogueData.ts`, and optionally `tsconfig.json`/`package.json` scripts. `public/assets/vocab-map.png` is left in place until the new map is accepted, then removed only on user approval (not in this project's scope to delete).

## 6. Acceptance criteria (numbered, testable)

Data and logic (automated unit tests)
1. The node dataset has exactly 135 nodes, 45 per kingdom, with unique `globalIndex` 1..135, `globalIndex = (kingdom-1)*45 + level`, and every record has numeric finite `x, y` inside the world bounds.
2. Consecutive nodes in a kingdom are between 90 and 200 world units apart, and no two nodes are closer than 90 units; level 1 of kingdom k+1 is above level 45 of kingdom k.
3. Kingdom 1 levels 1-13 match the reference's 13 node positions (section 2.5, normalized to the opening segment) within 12 world units.
4. Status derivation: for any (currentKingdom, currentLevel) in 1..3 x 1..45, exactly one node is `current`, all earlier nodes are `completed`, all later are `locked`/`unlocked`. Tested over all 135 combinations.
5. `computeWalkPath` between any two nodes returns a path starting and ending at them, passing only through the node chain (or gate for cross-kingdom), with no segment longer than 400 world units; for 135 x 135 pairs it completes in under 100 ms total.
6. `globalLevelNumber(k, q)` returns 1..135 and replaces the old offset table; `getStepRef` no longer wraps by modulo; passing level 46 returns `null`.
7. With backend `total_questions = 5` (current backend) the app is playable: levels 1-5 are interactive, 6-45 are shown as unavailable, and finishing level 5 transitions to the next kingdom.

Rendering (browser, verified with screenshots)
8. The demo renders K1 level 1 at 1774x887 viewport and the screenshot, compared side by side with `reference/vocab-quest-map.png`, shows: sky gradient with white blocky clouds, stepped pyramid hills, cube trees, blue block-water rivers with waterfalls, the green-roof school with DepEd sign, I(heart)EPCES WELCOME sign with the 6 colored letters + heart, Bayan colosseum with blue columns and lamp post, red-roof Provincial Capitol with Philippine flag and two yellow flags, wooden bridge, fences, winding path, vans and cars. A checklist of at least 20 itemized landmarks is scored; **all items must be present and a reviewer must rate the match "equal or closer" than the old PNG**. A structural-similarity or color-histogram comparison against the reference is reported in the README (no hard numeric gate, informational).
9. No network request for `vocab-map.png` or `vocab-quest-map.png` is made at runtime (checked in DevTools network tab or Playwright request log).
10. Screenshots at K1 L1, K1 L20, K1 L45 + gate, K2 L1, K2 L45 + gate, K3 L1, K3 L45 (finale) all render without gaps, seams between segments, or empty margins.
11. At devicePixelRatio 2, text and cube edges are crisp (no blur) in a 2x screenshot.
12. Resizing from 1920x1080 to 390x844 keeps the aspect ratio of the artwork (no stretching) and keeps the current node visible.

Effects
13. In a 3-second capture, water pixels, waterfalls, both flag types, tree canopy offsets, and clouds visibly change between frames; with reduced motion on, frames of the world layers are identical across 3 seconds.
14. The current node pulses; hovering a node shows the sky-blue glow and tooltip; completed nodes show 1-3 candy stars matching history; locked nodes appear dimmed.
15. Completing a level in the demo walks the avatar node to node with foot cycle, dust and step sound hooks, and the camera follows without exceeding clamp bounds.

Camera and interaction
16. Camera ease: after "Complete level", the current node is centered within 1.2 s, with no frame where the camera moves more than 25% of the viewport height.
17. Drag, wheel and pinch (touch emulation) pan and zoom; zoom clamps at min = fit width and max = 3.2; the viewport never shows outside the world.
18. The recenter button returns the camera to the current node within 1 s from any position, and is operable by keyboard.
19. After completing level 45 the avatar walks to the top gate, the gate animates, the title banner for the next kingdom shows its name and color for 2-3 seconds, then the camera arrives at level 1 of the next kingdom; input is locked until done and unlocked after; repeated 1 -> 2 -> 3.

Performance and quality
20. Demo reports at least 55 fps average over 10 s on a 4x CPU-throttled Chrome profile at 1366x768 for K1 L20 with quality 'medium', and at least 30 fps in 'low'.
21. Number of baked segment bitmaps in memory never exceeds the LRU limit while scrolling the whole world top to bottom; total bitmap memory stays under 150 MB (reported by the demo).
22. `prefers-reduced-motion` verified via emulated media feature (criterion 13).

Integration
23. In the real game (backend running, join with PIN 123456), the map screen displays the new map; kingdom click -> padlock -> dialogue -> question works; a correct answer shows the star burst, then the avatar walks to the next node; refresh keeps the position; teacher reset returns to level 1.
24. `npm run build` in `frontend-game` passes with 0 errors and the unit tests pass; no backend file is modified (`git status` shows no `backend/` change); no git commit is made by this project.
25. Folder check: all new files are under `frontend-game/MAP` except the integration touchpoints listed in section 5.

## 7. Out of scope
- Any backend change (models, controllers, migrations, seeders, tests, requests, resources). Documented in section 8 only.
- Teacher portal changes (question builder cap of 5, results page copy).
- Authoring the 135 questions, audio, or new teacher/guide sprites; changing the sprite/lip-sync system.
- Redesigning the question screen, HUD cards, menus, or sound design.
- 3D/WebGL perspective camera or real 3D models. The map is a 2D rendering (isometric-looking voxel art), with the camera panning and zooming in 2D.
- Multiplayer presence on the map.
- Deleting `vocab-map.png` or the stray `copy`/`dir` folders without approval.
- WCAG certification.

## 8. Required backend and portal follow-ups (NOT implemented here; copy to README)
1. **Raise the question cap**: `backend/app/Http/Controllers/QuestionController.php` `store()` blocks creation when `$map->questions()->count() >= 5` (422, "maximum of 5 questions"). Change to 45.
2. **Update the test** `backend/tests/Feature/QuestionTest.php` "question creation fails when map already has 5 questions (422)" to the new cap (45), and add a boundary test at 45/46.
3. **Seeders**: `backend/database/seeders/TeacherSeeder.php` seeds 5 questions per map (3 maps, 15 total). Extend to 45 per map (or document an import path); `maps.question_count` is already recalculated dynamically and the column is `tinyint unsigned` (max 255), so 45 fits. `questions.order_index` is `smallint unsigned`, which also fits.
4. **Results action**: `backend/app/Actions/GetRoomResultsAction.php` falls back to `$mapQuestionCounts->get($s->current_map_id, 5)`; change the default so it does not assume 5. The "Q n of 5" style progress text in teacher results should use the real count.
5. **Hard-coded image rule**: `backend/app/Http/Resources/StudentQuestionResource.php` returns `image_url = null` when `map_id === 2`. This depends on DB id and should be keyed by `order_index` or a per-question flag, otherwise levels 1-45 of the "medium" kingdom behave by id coincidence.
6. **Kingdom identification**: frontend uses `map.id` as kingdom number. Backend should guarantee `map.order_index` (1, 2, 3) in `GET /api/game/question` (it already returns it) and in `completed_questions` add `map_order_index` so clients need not assume ids 1-3.
7. **Docs**: `docs/architecture.md` (Map 1 = 3 questions, Map 2 = 5, Map 3 = 5) and `docs/rules-and-validation.md` (fixed question order table "Map 1 -> 3 Qs -> Map 2 -> 5 Qs -> Map 3 -> 5 Qs") are outdated even before this change; update to 45 per map.
8. **Teacher portal** (`frontend-portal/src/pages/QuestionsPage.tsx` lines about 256 and 562): hard-coded `questions.length >= 5` and toast text "limited to a maximum of 5 questions". `RoomControlPage.tsx` comment/sort assumes "question 1 to 15" (check the sorting logic for 135). Test `RoomResultsTest.php` mentions "question 1 to 15" and should be extended.
9. **Performance of `show()`**: it loads all of a map's questions with answers into cache and queries all correct answers of the session on every call. With 45 per map and 135 total, re-check query cost and the cache invalidation (`map_questions_{id}`) under 500 students polling. Consider returning `completed_questions` only for the active map or paginating.
10. **Progress model**: add an explicit "current global level" or `current_level_number` in the response to remove client-side derivation, and keep `total_questions` honest so the frontend can render "coming soon" nodes (FR-30).
11. **Audio/content**: voiceover text in kingdom dialogues references levels "1 to 5", "6-10", "11-15"; re-record or edit after the level ranges change (content task, not code).

## 9. Assumptions and open points (for the design review)
- A1. "Current is 5 levels per kingdom, 15 total" (user-confirmed) and the target is 45 per kingdom, 135 total.
- A2. Kingdom 1 contains the full reference scene as its first segment even though that scene shows the Bayan hall and the Capitol; those two kingdoms' *playable* worlds are the new themed segments above it. If the product owner prefers K1 to show only the school, the opening segment must be re-composed; this changes FR-5 only.
- A3. Global level numbers 1-135 are shown in the star burst and HUD; per-kingdom 1-45 is used in dialogue wording (FR-32 chooses one).
- A4. Which of the two supplied images is "13 nodes" vs "15 nodes" is taken from the setup note and file sizes; re-confirm by path.
- A5. The brief's 1024x506 size and percentage coordinates are superseded by the real 1774x887 measurements.
- A6. Phaser is not used by the current renderer; the design step may choose plain Canvas 2D (recommended continuity with `game2d.ts`) or Phaser 4 and must justify it.
- A7. Number of playable levels depends on the backend until follow-ups land; FR-30 keeps the app working in between.
