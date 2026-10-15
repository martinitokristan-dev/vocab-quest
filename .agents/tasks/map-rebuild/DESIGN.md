# Vocab Quest: Code-Rendered Voxel World Map. Technical Design

Status: design only. No runtime code, backend file or git state was changed.
Inputs: `REQUIREMENTS.md` (FR-n, NFR-n, AC-n refer to it), `setup-note.md`, both reference PNGs (viewed), `frontend-game/src/{game2d,mapFlowController,main}.ts`, `WorldMapScreen.ts`, `package.json`, `tsconfig.json`.
This is **revision pass 4**, answering the third review (0 HIGH, 5 MEDIUM, 3 NIT). Section 22 lists the response to each (pass 3 and pass 2 responses are kept below it). Pass 4 changes: sound hooks interface and mapping table (4, 5.4, 8, 10), milestone-0 perf gate aligned with AC20 (9.2, 21), kingdom and node gating rule table (5.4, 10), eager `flowMode` resolution (19.1, 18, 20, D13), L9 anchor nudge with re-pinned A and B (3.3, 3.4, D2), demo relative imports (14), README limitations (13, D4, 14.0). Earlier, pass 3 changes: K1 exit route re-derived with pinned nodes (3.4), K1 S1 far-field grid mechanism (2.3), camera offset sign (5.2), `GateRecord`/`EntranceRecord` (3.2), fidelity metric and checklist scoping (14.0, 14.1, D3, D4), sound hooks (4, 8), and small numeric fixes.
Earlier pass summary:  Changes from the first draft are: 7 segments per kingdom (world 18,627 units tall), a K1 exit route that avoids the Capitol, corrected `MapRenderer` typing, availability-aware statuses, a warp-based kingdom transition, a fidelity protocol, a memory-aware bake cache, a runtime `flowMode`, a `kingdomByMapId` map, and a safer tsconfig.

## 1. Overview

The map becomes a **Canvas 2D renderer** (class `VoxelWorldMap`) over a tall, deterministic, procedurally generated voxel world. The world is 1774 units wide and 18,627 units tall (3 kingdoms x 7 segments of 1774x887 = 21 segments). Static art is **baked per segment into offscreen canvases** and blitted only when visible. Animated pieces (water, waterfalls, flags, trees and bushes, clouds, sparkles) are a thin dynamic layer on top. Nodes, avatar, tooltips, banner, HUD and an accessibility proxy are DOM/Canvas elements managed by the same class. The class has the same public surface as `Game2DMapRenderer`, so `WorldMapScreen`/`main.ts` swap one factory call. The old PNG renderer stays untouched as a fallback and rollback path.

Technology stack (locked on approval): TypeScript 6 (repo settings), Vite 8, **Canvas 2D** (no Phaser, no WebGL), DOM + inline SVG icons from the existing `src/icons.ts` for HUD, `vitest` for unit tests (dev dependency only). No runtime dependencies are added.

Everything below is a decision, not an option. Where the requirements conflict with each other or with measured reference data, the conflict is listed in section 15 with the resolution.

## 2. Rendering architecture

### 2.1 Why Canvas 2D and not Phaser 4 or WebGL

Phaser 4 is in `package.json` but is imported nowhere, and the current renderer (`game2d.ts`) is a hand-rolled Canvas 2D loop with the full set of interactions the game depends on (kingdom plaques, padlock, walk, bubbles). Reasons to stay on Canvas 2D:

- The workload is mostly blitting a few pre-baked bitmaps plus about 200 small sprites per frame. Canvas 2D hardware acceleration handles that at 60 fps on the target devices. WebGL's advantage (thousands of dynamic quads, shaders) is not needed.
- Phaser would add about 1 MB+ to the bundle in the one screen of the app that uses it, require re-implementing the whole `Game2DMapRenderer` surface (padlock, plaques, avatar bubbles, tooltips, sound hooks, `remount`) inside a Phaser Scene, and introduce a second game loop and input system next to `main.ts`. Phaser's texture and camera features are replaceable by about 300 lines of our own code.
- Phaser 4 is allowed only if it shows a benefit (NFR-7). It does not here. The unused dependency is left alone (removing it is not this project's job).
- Shipping a WebGL path would also need a Canvas 2D fallback for devices where WebGL is blocked, doubling the work.

### 2.2 Layer stack

One `<div class="vq-map-root">` is mounted in the container passed to the constructor (`#canvasContainer`). Children, bottom to top:

1. `canvas.vq-world` (the only full-screen canvas): per frame draws in this order
   1. sky/backdrop fill (screen space, cheap gradient cached by kingdom tint),
   2. far cloud layer (parallax 0.3),
   3. visible baked segments (`drawImage`, 1 to 3 at a time),
   4. dynamic ground effects: water shimmer, waterfalls, path glints (clip rectangle lists, section 8),
   5. depth-sorted object pass: trees, bushes, lamp glow, flags, nodes, stars, avatar, run dust (sorted by base `y`),
   6. near cloud layer (parallax 1.15) and ambient sparkles,
   7. locked-kingdom mist and 3D padlock, kingdom plaques,
   8. screen overlays (vignette, fade used for warp and reduced-motion transitions).
2. `div.vq-hud`: progress chip, recenter button, kingdom mini-indicator, tooltip, kingdom title banner (all DOM, `pointer-events` limited to controls).
3. `div.vq-a11y`: visually hidden `role="list"` of up to 24 focusable `<button>` proxies, one per visible node (section 11), and an `aria-live="polite"` region.

Decision: nodes and the avatar are drawn on the canvas (they must be depth-sorted with trees and share the sway/cull pipeline). DOM proxies exist only for keyboard and screen readers and for the 44 px tap targets. Pointer hit-testing on canvas is done in code (as `game2d.ts` does today); the proxies are not used for pointer input. This avoids 135 live DOM nodes.

### 2.3 Coordinate system and projection

- World units: 1 unit = 1 CSS px at zoom 1 on the reference. `WORLD_W = 1774`. `SEG_H = 887`. `SEGMENTS_PER_KINGDOM = 7`. `KINGDOM_H = 7 * SEG_H = 6209`. `WORLD_H = 21 * 887 = 18627`. World y = 0 is the top (K3 summit), y grows downward. K3 occupies `[0, 6209)`, K2 `[6209, 12418)`, K1 `[12418, 18627)`.
- Authoring coordinate `u` = distance up from the bottom of a kingdom (`u = 0` at the kingdom's bottom edge). Conversion: `worldY = kingdomBottomY(k) - u`, with `kingdomBottomY(k) = (4 - k) * KINGDOM_H` (K1 = 18627, K2 = 12418, K3 = 6209).
- Segment index `s` (global, 0 at the top) = `floor(worldY / 887)`; segment `(k, n)` with `n = 1..7` from the bottom: `s = (3 - k) * 7 + (7 - n)`, range 0..20.
- Voxel grid: `CELL_W = 18` units horizontally, `CELL_D = 10` (depth step on screen), `CELL_H = 14` (one height level). 99 columns (the last is clipped). Projection is oblique, matching the reference, which is a front 3/4 top view: a column at grid `(i, j, h)` has its top face at screen `y = j*CELL_D - h*CELL_H`, a top face of `18 x 10` and a front face of `18 x 14` per level. Decision: cube size is **18 everywhere except a perspective band inside K1 S1 only**. The reference shrinks cubes toward its horizon, which cannot repeat over an 18k-unit world without seams. To stay "identical, not less identical" in the one screen that is compared with the reference, the K1 S1 **far-field layer** uses a scale curve `s(refY)`: 1.0 for refY >= 450, falling linearly to 0.78 (14 units) at refY = 180, then rising linearly back to 1.0 at refY = 0. The curve is 1.0 at both S1 edges, so S1 tiles with S2 and with the 18-unit sea without any visible step. Landmarks, nodes and path cubes always use 18.

**Far-field mechanism (pass 3, finding 4).** The far-field layer of K1 S1 is the terrain in `refY < 450` that is not path, landmark or water. It is baked row by row, independent of the 18-unit grid:
- Row `r` is a horizontal strip of depth `CELL_D * s(y_r)` where `y_r` is the strip's centre and rows are generated from `refY = 450` upward (rows step by `CELL_D*s`, so row boundaries are not on the 10-unit lattice; the first row starts exactly at refY = 450 and the last row is clipped at refY = 0).
- Row cube width is `w = 18 * s(y_r)`; `columns = ceil(1774 / w)`; column `c` covers `x = c*w .. (c+1)*w`.
- Height level for each cube is **sampled from the world-space noise at the cube centre `(x, y)` in world units**, not from a cell index, so the noise field is the same continuous function the 18-unit sea uses (stage 1 of 6.2). This is why the band shows no discontinuity at refY = 450 or 0 (s = 1.0 there, so cubes and sample points coincide with the 18-unit sea's up to the 10-unit lattice offset, which is invisible under per-voxel noise).
- Rows are drawn back to front (top of screen first). Each cube draws a top face `w x (CELL_D*s)` and a front face `w x (CELL_H*s)` per height level; colours come from the same material and lighting rules (2.3).
- Path, landmarks and water are drawn **afterwards** on the 18-unit grid on top of the far-field, each with a 1-cell (18 units) skirt: the skirt cells at the boundary are drawn with the foreground material (grass or dirt) at 18 units so the shrunken background meets the 18-unit objects at a neat step instead of overlapping cubes. Landmarks that stand at refY < 450 (Capitol, hall top) are 18-unit objects by definition; the perspective only affects background cubes, as in the reference where buildings are larger than the hills behind them.
- A unit test (`farfield.test.ts`) asserts: `s(0) = s(450) = 1.0`, `s(180) = 0.78`, row y-extents tile with no gap or overlap from refY = 450 to 0, and each row's `columns * w >= 1774`. Distant pyramid hills elsewhere use 12-unit cubes to suggest depth. The overall softness of the compromise is measured by the fidelity protocol (section 14.1).
- Lighting (FR-15): light from the upper left. Top face: base colour lightened by 14%. Front face: base. Each face gets a 2-unit highlight strip on its left edge (+10%) and a 2-unit shadow strip on its right edge (-14%) plus a 1-unit darker outline (-30%, alpha 0.5). Per-voxel brightness noise of +/-5% (seeded) gives the grainy reference texture. Contact shadow under trees and buildings is an alpha-0.22 ellipse offset right/down.

## 3. World model: 3 kingdoms, 7 segments each, 135 nodes

### 3.1 Segment count: decision and justification

Each kingdom = **7 segments of 1774x887** (a "screen" in the reference's 2:1 aspect), stacked vertically: 21 segments total, 6,209 units per kingdom (= 7.0 reference heights, the low end of FR-3's "about 7-10"). `SEGMENTS_PER_KINGDOM` is a single constant in `world.ts`. Justification:

- FR-3 asks for about 7 to 10 heights, so 7 is chosen as the smallest value that meets it. More heights only add scenery and bake memory; nothing in the node maths needs them.
- Node spacing must stay between 90 and 200 units (AC2). Spacing is arc length / 44 (K2, K3) or / 32 (K1 L14 to L45), and arc length is a free design variable through the spine waypoints (3.3). With 7 segments the K2 and K3 spines get four full diagonal runs plus hairpins, about 7.4k arc, about 168 per hop, which leaves margin on both bounds.
- Average 6.4 nodes per segment means a typical phone viewport (about 1,500 units tall at zoom 0.55) shows about 9 nodes (FR-12 requires at least 3).
- Segment-level bake granularity: 1774x887 at bake scale 2 is 3548x1774, under the 4096 side limit, 25 MB each at scale 2. This is the unit for culling and LRU (section 9.1).

Segment ids: `K{k}S{n}` with n = 1 (bottom) to 7 (top). Fixed contents (see 3.4 for the seams):

| Segment | K1 EPCES | K2 Bayan ng Prosperidad | K3 Provincial Capitol |
|---|---|---|---|
| S1 | **Reference scene**: school, welcome sign, hall, capitol, nodes L1-13, boardwalk exit | Cloud stairs arrival, municipal gate arch, plaza, levels 1 to ~6 | Cloud stairs arrival, grand gate arch, levels 1 to ~6 |
| S2 | garden terraces, river and bridge | market street | cypress groves, stone terraces |
| S3 | playground meadow, waterfall cascade | lake promenade, fountain | vehicle courtyard, monuments |
| S4 | hills and tree groves | plaza ring, colosseum annex | colonnade drive |
| S5 | river valley, long bridge | stone bridges over wide lake | coastal cliff edge |
| S6 | orchard terraces, second waterfall chain | boat pier, reed marsh | vineyard terraces, belvedere |
| S7 | gate plateau, top gate, horizon, sky | hall landmark (colosseum), top gate, sky | capitol summit, finale steps, sky (no gate, finale) |

### 3.2 Data files (single source of truth)

`MAP/data/` contains typed TS modules (no JSON, to get type checking and `as const`):

- `world.ts`: constants above, `KINGDOMS` definitions (id, name, subtitle, colour, tint, zones, seed).
- `spines.ts`: the three spine waypoint lists (3.3).
- `nodes.ts`: **generated at build/test time, committed**: `NODES: readonly NodeRecord[]` with 135 records, produced by `MAP/tools/generate-nodes.ts` from spines + K1 anchors. The generated file is the contract; a test regenerates it and fails on any diff. The same generator also writes `data/gates.ts` (`GATES: GateRecord[]`, `ENTRANCES: EntranceRecord[]`, below).
- `scenes/k1.ts`, `k2.ts`, `k3.ts`: per-segment scene scripts (landmarks, rivers, bridges, decor zones).
- `models/*.ts`: voxel model definitions (section 7).

```ts
export type KingdomId = 1 | 2 | 3;
export type NodeStatus = 'locked' | 'unlocked' | 'current' | 'completed';

export interface NodeRecord {
  readonly kingdom: KingdomId;
  readonly level: number;          // 1..45, per kingdom
  readonly globalIndex: number;    // (kingdom-1)*45 + level, 1..135
  readonly x: number;              // world units, node centre, 0..1774
  readonly y: number;              // world units, from world top, 0..18627
  readonly blockH: number;         // standing block height (avatar offset), 54..66
  readonly segment: number;        // global segment index 0..20
  readonly hop?: 'bridge';         // marks the two reference gaps > 200 (section 15, D2)
  readonly station?: string;       // tooltip/bubble name (reuses existing zone names)
}
export interface NodeState extends NodeRecord {
  status: NodeStatus;
  available: boolean;              // level <= total_questions for its kingdom
  stars: 0 | 1 | 2 | 3;
}
```

`status` is never stored in data (FR-1). Runtime `NodeState` is built by `deriveStatuses` (3.5).

Gate and entrance geometry (pass 3, finding 6) is data too. `world.ts` exports:

```ts
export interface GateRecord {            // top gate of K1 and K2 (K3 has none)
  readonly kingdom: 1 | 2;
  readonly archX: number; readonly archY: number;        // gate centre, world units
  readonly frontX: number; readonly frontY: number;      // where the avatar stops before the doors
  readonly nextSpawnX: number; readonly nextSpawnY: number; // avatar re-spawn at the next kingdom's entrance
}
export interface EntranceRecord {        // click target + mist anchor, one per kingdom
  readonly kingdom: KingdomId;
  readonly hit: { x: number; y: number; w: number; h: number }; // world units, at least 320x200
  readonly spawnX: number; readonly spawnY: number;      // avatar position while the kingdom is awaiting its click
}
```

Rules: `archY = kingdomBottomY(k) - 5850` (u = 5850); the gate front is **150 units beyond L45 along the spine end tangent** (u = 5800, x = L45.x), so the L45-to-front distance is 150 (test bound 100 to 250). The entrance hit rect is centred at u = 170, x = L1.x (K2, K3), 320x200; the spawn is at `(L1.x, u = 260)`. Concrete values (also committed in `data/gates.ts`, generated together with `nodes.ts` and verified by test):

| Record | Values (world units) |
|---|---|
| Gate K1 | arch (887, 12777); front (887, 12827); nextSpawn = Entrance K2 spawn |
| Gate K2 | arch (1000, 6568); front (1000, 6618); nextSpawn = Entrance K3 spawn |
| Entrance K1 | hit {x:20, y:18260, w:390, h:210} (the "I (heart) EPCES WELCOME" sign rect 30,530,400,720 reference px, padded 10, `worldY = 17740 + refY`); spawn = L1 position (175, 18515) |
| Entrance K2 | hit {x:440, y:12148, w:320, h:200}; spawn (600, 12158) |
| Entrance K3 | hit {x:1014, y:5939, w:320, h:200}; spawn (1174, 5949) |

(K2 L45 is at (1000, 6768); K1 L45 at (887, 12977); K2 L1 at (600, 12088); K3 L1 at (1174, 5879).) Used by: `walkPlan` (gate front, nextSpawn), the gate animation (arch), the camera travel (entrance spawn), the click target (hit rect) and the lock mist (hit rect plus the kingdom's lower half). `gates.test.ts` asserts the L45-to-front distance is 100 to 250, every hit rect has w >= 320 and h >= 200 and lies inside its kingdom's world-y range, and each spawn lies inside the hit rect expanded by 120.

### 3.3 Path routing (spines)

A **spine** is a Catmull-Rom (centripetal, alpha 0.5) curve through waypoints given in `(x, u)`. Nodes are placed at equal arc length along the spine between the first and last anchor. This yields spacing within the 90 to 200 bound by construction, and the generator test asserts it.

Per-kingdom constants: `LEVEL1_U = 330` (**K2 and K3 only**; K1 L1 is anchored at u = 887 - 775 = 112 and K1 has no cloud-stairs zone, its bottom is regular terrain), `LEVEL45_U = 5650`, `TOP_GATE_U = 5850` (gate arch centre; K3 has no gate), sky gate zone `u > 5879`, cloud-stairs arrival zone `u < 330` (K2 and K3 only).

**Pins** (pass 3): a spine may declare pinned nodes `{ level, x, y }` that are placed exactly at a given point; the generator places nodes at equal arc length **between consecutive pins** (and between anchors/pins and the spine end), so the pin is the only way to force a node into or away from a tight corridor. The generator asserts that the arc between consecutive pins divided by the level difference is within 90 to 200.

- **K2** (levels 1 to 45), waypoints in `(x, u)`: `(600,330) (1450,1438) (320,2546) (1450,3654) (320,4762) (1000,5650)`. Straight-line run lengths 1396, 1583, 1583, 1583, 1118 sum to 7,263; Catmull-Rom smoothing adds about 2 to 4 percent, so the arc is about 7.4k and the spacing about 168 (bound 90 to 200).
- **K3** (explicit list, mirror of K2 in x, `x' = 1774 - x`): `(1174,330) (324,1438) (1454,2546) (324,3654) (1454,4762) (774,5650)`. Same arc length, same spacing.
- **K1**: levels 1 to 13 are **fixed anchors** from the reference (section 3.4). Levels 14 to 45 follow a spine starting at node 13 (32 intervals), given in **world-px / reference-px for S1 and (x, u) beyond**: the boardwalk legs (3.4) `L13 (1637,488) -> (1700,557) -> (1450,587) -> A (1245,496) -> B (1196,304) -> (1180,120) -> (1130,57)` (reference px, i.e. u = 887 - refY), then `(1130,830u) (850,2300u) (1050,3900u) (887,5650u)`. **Pins**: `L17 = A (1245,496)` and `L18 = B (1196,304)` (reference px; both moved a few units in pass 4 to clear the nudged L9, see 3.4). Lengths: L13 to A about 564 (about 576 after smoothing, 4 hops, about 144 each); A to B 198.2 (one hop, margin 1.8, so the generator test is the arbiter and A/B may be nudged by up to 4 units, never closer than the clearances in 3.4); B to L45: 182 + 80 + 1496 + 1612 + 1757 = about 5,127, about 5,230 after smoothing, 27 hops, about 194 each (bound 200; the margin is thin, so the generator test is the arbiter). **K1-only lever**: if any K1 hop exceeds 200 the implementer may lower K1's `LEVEL45_U` down to 5450 (the arch stays at u = 5850; the gate front is always `L45.u + 150` so K1's front becomes u = 5600 and `data/gates.ts` is regenerated; the 100 to 250 test still holds). Straightening the S-curve in S3 to S6 lowers spacing; adding lateral amplitude raises it.
- **Adjustment rule** (the waypoint tables are measured starting values, not guaranteed): `generate-nodes.ts` prints the min and max hop and the clearance to every landmark rect; if any bound fails, the implementer moves interior waypoints only (never the anchors L1 to L13, the pins, nor `LEVEL1_U`, `TOP_GATE_U`; `LEVEL45_U` only via the K1 lever above) until the test passes. Lateral amplitude in a run raises spacing; straightening it lowers spacing.
- Hairpin turn radius is at least 150 units (the Catmull-Rom control points are inset by 150 along the run direction), so equal-arc nodes never come closer than 90.
- The spine also drives scenery: terrain cells within `PATH_HALF_W = 26` of the spine are flattened to the path height and receive the cobblestone material; trees, bushes and landmarks are rejected within `PATH_CLEAR = 70`.

### 3.4 K1 opening segment: matching the reference

K1 S1 (`u` 0..887) uses `worldY = 17740 + refY`, `x = refX`.

- Anchors L1 to L13 (reference px, from the setup note, to be re-measured by the implementer on the actual file within +/-4 px before committing): `(175,775) (352,722) (502,667) (713,540) (808,565) (925,573) (1043,566) (1153,537) (1266,364) (1345,413) (1430,445) (1525,472) (1637,488)`. **L9 is the one anchor moved from the measured reference position (1270,368) to (1266,364)** (pass 4, finding 5): in the reference L9 to L10 is only 87.5 units, below the 90-unit minimum of AC2. The nudge is 5.7 units, inside AC3's 12-unit tolerance, and gives L9 to L10 = 93.0. All other anchors are used as measured (AC3 is met exactly for them). Resulting anchor spacings, all checked: L1-L2 185, L2-L3 160, L3-L4 246 (bridge), L4-L5 98, L5-L6 117, L6-L7 118, L7-L8 114, L8-L9 207 (bridge), L9-L10 93, L10-L11 90.8, L11-L12 99, L12-L13 113. L10-L11 has only 0.8 margin: if the +/-4 px re-measurement lowers any anchor pair below 90, the implementer moves the **later** node of that pair away by at most 6 units (still inside AC3's 12); `nodes.test.ts` asserts the 90 floor on the final committed anchors with no exemption except the two bridge hops.
- Hops L3->L4 (246 units, the wooden bridge) and L8->L9 (207 units) exceed 200; they are tagged `hop: 'bridge'` (section 15, D2).
- The reference's top sky band (y < 130) is **not** reproduced as sky inside K1 S1: it is replaced by continued ground (pyramid hills and trees) so S1 tiles seamlessly with S2. Two clouds from the band are kept as near-cloud sprites over the hills. All other reference elements remain at their reference positions (checklist in 14.1).
- **Landmark footprint table for K1 S1** (reference px, `x0,y0,x1,y1`, measured by eye from the reference; the implementer re-measures to +/-6 px and commits the final values to `scenes/k1.ts` as `K1_S1_FOOTPRINTS`; `nodes.test.ts` imports them):

| Landmark | Rect |
|---|---|
| school (incl. green roof, school sign wall) | 80,320,460,520 |
| EPCES sign + WELCOME planter + fence | 30,530,400,720 |
| hall (Bayan colosseum incl. steps, lamp post) | 730,270,1080,520 |
| lamp post | 1000,420,1030,520 |
| playground tower west (with slide) | 425,370,525,515 |
| playground tower east (with slide) | 1050,350,1145,505 |
| Capitol incl. roof and flags | 1325,95,1752,345 |
| van (west) | 645,400,730,490 |
| van (north-east) | 1262,268,1342,335 |
| red car + dark SUV | 1612,333,1762,402 |
| wooden bridge (L3 to L4) | 548,585,668,668 |

Rule: every node (L1 to L45) is at least 60 units from every non-bridge footprint rect, except nodes whose anchors the reference itself places next to a building (L1 to L13 are exempt because they are measured from the reference). Movable props not listed above (fences at about (1190,300), flower beds, small rocks) may be relocated by the scene script to clear the route.
- **K1 exit route (pass 3, finding 3)**. In the reference the path ends in a curl at the right edge below the Capitol (node 13 at (1637,488)); the Capitol, cars and the right edge close the way north, and the river closes the south. L14 to L45 therefore continue as a **wooden boardwalk** that leaves the curl, turns back west along the south bank, crosses the waterfall(s) on small plank bridges (reusing `bridge_wood`), and enters the gap between the hall/east tower and the Capitol, then runs north. Reference px: `(1637,488) -> (1700,557) -> (1450,587) -> A (1245,496) -> B (1196,304) -> (1180,120) -> (1130,57) -> off the S1 top edge`.
  - **The corridor is only 121 wide** (east tower x <= 1145 to L9 x = 1266), so equal-arc placement cannot be trusted there. The design therefore **pins** the two nodes in that corridor (3.3): L17 at A and L18 at B. Computed clearances (reference px, Euclidean, with the nudged L9 = (1266,364)): A to L8 (1153,537) = 100.7; A to L9 = 133.7; A to the L8-L9 path centreline = 54.6 (path half width 26 plus node half width 24 leaves a 4.6 gap); B to L9 = 92.2 (the pre-nudge pins A (1245,500), B (1200,310) would have given 85.3 and broken the 90 rule); B to the east tower's nearest corner (1145,350) = 68.7 (>= 60); B to the Capitol west wall (x = 1325) = 129; A to B = 198.2 (a single hop <= 200); L13 to A about 576 over 4 hops about 144 each. No other node lies between A and B (they are consecutive levels), so the infeasible corridor never holds an unpinned node.
  - **Junction rule**: the segment A to B crosses the L8 to L9 stone path at about (1227,424) (the stone line passes about (1205,457) in the reference). The crossing is drawn as a 3-cube-wide `bridge_wood` plank pad laid over the stone path, a visibly different material (brown planks with rails) from the cream cobblestone, so the boardwalk reads as passing over the stone path rather than merging with it. The pad has no node on it.
  - **Polyline checks** added to `nodes.test.ts`: the boardwalk polyline stays at least 45 units from every L1 to L13 centre except where it crosses the pad (a documented exemption for the single crossing), and every node L14 to L45 keeps 90 units from L8 and L9 and 60 from every non-bridge footprint (tower footprint is the table value 1050,350,1145,505). The old `noNodeRanges` idea is not needed because pins replace it.
  - The scene script relocates the movable fence near (1190,300) and the flower beds out of the A-to-B corridor. The route is a visual U-turn at the curl; this is accepted and mitigated by the plank bridges and path signs so it reads as an intended switchback.

### 3.5 Pure logic modules (no DOM)

- `deriveStatuses(progress, availability) -> NodeState[]`: `progress = {currentKingdom, currentLevel, completed: {kingdom, level, stars}[]}`. **Single rule** (finding 2):
```
available(k,l) = l <= availability[k]          // availability[k] defaults to 45 if unknown
status(n) = !available(n)            ? 'locked'     // never completed or current; shown "coming soon"
          : n.globalIndex <  currentGlobal ? 'completed'
          : n.globalIndex === currentGlobal ? 'current'
          : 'locked'
stars(n)  = completed && available ? (history stars, 1..3; missing -> 3) : 0
```
`'unlocked'` stays in the type but is never produced (D7). Edge case: if `currentGlobal` itself is unavailable (server says level 7 of a 5-question kingdom), no node is `current`; the avatar is placed on the last available node of that kingdom and a `console.warn` is logged. The "exactly one current" invariant therefore reads: exactly one current among available nodes whenever the current node is available. Test table row: availability `{1:5,2:5,3:5}`, current = K2 L1 (global 46): K1 L1-5 `completed`, K1 L6-45 `locked` and `available=false`, K2 L1 `current`, K2 L2-5 `locked`, K2 L6-45 `locked` and unavailable, exactly one `current`.
- `computeWalkPath(from, to)`: if same kingdom, the polyline of samples along the spine between the two nodes; cross kingdom, `from -> (along the spine, through any greyed nodes) -> gate front -> next kingdom entrance -> to`, where `from` is whatever node the avatar is on (level 45 in the full game, the last available level when the backend serves fewer questions); long approaches are shortened for animation by `walkPlan` (5.4). Consecutive points are at most 60 units apart (so AC5's "no segment longer than 400" holds), and the total sample count is capped at 600 for the pure function (135 x 135 pairs under 100 ms using precomputed cumulative arc-length tables). `walkPlan` (5.4) is the only function the game flow calls for animated moves.
- `globalLevelNumber(k, q) = (k-1)*45 + q` with range check.
- `camera.ts` math: `clampToWorld`, `fitZoom`, `minZoom`, `zoomAround`, `smoothDamp`, `glideDuration` (section 5).
- `layout.ts`: node generation from spines, `nearestNode`, `segmentForY`.

## 4. Component API

`MAP/src/VoxelWorldMap.ts` exports `class VoxelWorldMap implements MapRenderer`. `MapRenderer` is an interface in `MAP/src/api/types.ts` containing exactly the methods the game uses (below). `Game2DMapRenderer` already satisfies it structurally (checked at compile time in the factory by assigning to `MapRenderer`; `game2d.ts` is not edited).

```ts
export interface StarHistoryItem { mapId: number; orderIndex?: number; questionIndex?: number; stars: number }
// same shape as game2d.ts so main.ts data passes through unchanged.

export interface MapFlowOptions { activeMapId: number; enteredKingdomIds: number[]; mapPhase: string }

export interface MapRenderer {
  updateProgress(activeMapId: number, qIndex: number, starsHistory?: StarHistoryItem[]): void; // history optional, as game2d.ts
  setMapFlowOptions(o: MapFlowOptions): void;
  isInputLocked(): boolean;
  playKingdomEntryAnimation(kingdomId: number): Promise<void>; // resolves when the 1.5 s zoom + fade ends
  animatePadlockUnlock(kingdomId: number): Promise<void>;      // resolves after the 850 ms unlock
  clearEntryFade(): void;
  centerOnLocation(x: number, y: number): void;
  centerOnKingdom(id: number): void;
  centerOnActiveLocation(): void;
  animateWalkingPath(waypoints: Array<{x: number; y: number}>, bubbleText: string, onArrival: () => void): void;
  // Registration METHODS (last registration wins), exactly as game2d.ts lines ~869-880 and main.ts ~1498-1510:
  onStepClick(cb: (mapId: number, questionIndex: number) => void): void;
  onKingdomClick(cb: (kingdomId: number) => void): void;
  onLockedKingdomClick(cb: () => void): void;
  remount(container: HTMLElement): void;
  destroy(): void;
}
```

Corrected after review (finding 1). The three click hooks are registration methods, not properties, and the two entry animations return promises that `main.ts` `await`s. Before writing the interface the implementer re-reads `game2d.ts` lines 560-900 and any signature that differs from this block wins (the block is a snapshot of what the reviewer verified). Proof of compatibility is a compile-time test file `MAP/tests/types.test-d.ts` containing `import type { Game2DMapRenderer } from '../../src/game2d'; const _a = null as unknown as Game2DMapRenderer satisfies MapRenderer;`, compiled by `tsc -p MAP/tsconfig.tools.json` in `npm run map:test`. `game2d.ts` is not edited; if the `satisfies` check fails for any reason, the interface is relaxed (never `game2d.ts` edited) until it passes. The new `on()` API (below) is the voxel-only richer API; `onStepClick/onKingdomClick/onLockedKingdomClick` register into the same dispatcher (`on('levelClick')`, `on('kingdomClick')`, `on('lockedKingdomClick')`), and a new registration replaces the previous legacy one. `VoxelWorldMap` does not rename anything the game already calls.

Constructor (the old one plus one optional trailing argument): `new VoxelWorldMap(container, avatarImgUrl, activeMapId, currentQuestionIndex, customMaps?, initialPlayerPos?, starsHistory?, mapFlowOptions?, hooks?)` where `hooks?: MapSoundHooks` (all members optional, default no-ops):

```ts
export interface MapSoundHooks {
  hover?(): void; click?(): void; wrong?(): void; step?(): void;
  padlockUnlock?(): void; whoosh?(): void; success?(): void; gateOpen?(): void;
}
```

**Hook mapping table** (pass 4, finding 1). `soundManager` has no `playUnlock` or `playLocked`; the factory in `MAP/src/index.ts` builds the hooks object from the functions that exist (verified: `playHover`, `playClick`, `playWrong`, `playStep`, `playSuccess`, `playWhoosh`, `playPadlockUnlock`), matching what `game2d.ts` plays today:

| Hook | `soundManager` call | Fires when |
|---|---|---|
| `hover` | `playHover` | pointer enters a node or an unlocked entrance (once per entry, as `game2d.ts`) |
| `click` | `playClick` | a kingdom entrance hit that emits `kingdomClick`, and a node hit that emits `levelClick` |
| `wrong` | `playWrong` | a click on a locked, unavailable or un-entered node, and a click on a locked kingdom entrance (the existing locked-click sound) |
| `step` | `playStep` | during walks, every 24 units, rate-limited to 6 per second |
| `padlockUnlock` | `playPadlockUnlock` | the 850 ms padlock unlock in `animatePadlockUnlock` |
| `whoosh` | `playWhoosh` | twice in `playKingdomEntryAnimation`: at its start and at the push-in (zoom) phase, as `game2d.ts` |
| `success` | `playSuccess` | walk arrival, when the "QUEST READY!" bubble appears |
| `gateOpen` | `playPadlockUnlock` (decision: the closest existing unlock sound; no new audio asset) | start of the gate doors animation (5.4 step 2) |

The demo supplies its own no-op or WebAudio-blip hooks.

**Import boundary (pass 3, finding 11).** Everything under `MAP/src` and `MAP/data` is free of imports from `frontend-game/src` **except `MAP/src/index.ts`** (the factory), which imports `../../src/game2d` (for the PNG fallback) and `../../src/soundManager` (to build the `hooks` object passed to the voxel renderer) (icons are not imported; `hud/icons.ts` is local). `VoxelWorldMap` never imports `soundManager`; it calls `hooks.*`. The demo imports only `MAP/src/VoxelWorldMap` (not `index.ts`) and passes `hooks` of its own (no-ops, or a tiny WebAudio blip toggled by a checkbox), so the demo does not pull in `game2d.ts` or the game's audio. A unit test (`importBoundary.test.ts`) greps `MAP/src/**` and `MAP/data/**` for `from '../../src` / `from '../../../src'` and fails on any file other than `MAP/src/index.ts`.

Semantics: `activeMapId` is the kingdom number (resolved by the caller with `kingdomIdOf(map)`, FR-31), `currentQuestionIndex` is **per-kingdom 1..45** (the server's `current_question_num`). `initialPlayerPos` is accepted for compatibility and ignored when the node can be derived from progress.

New API (FR-26), all optional for existing callers:

```ts
setProgress(p: { currentKingdom: KingdomId; currentLevel: number;
                 completedLevels: Array<{ kingdom: KingdomId; level: number; stars: number }> }): void;
setAvailability(totalQuestionsByKingdom: Partial<Record<KingdomId, number>>): void; // FR-30
getNodePosition(kingdom: KingdomId, level: number): { x: number; y: number; blockH: number } | null;
getGlobalIndex(kingdom: KingdomId, level: number): number | null;
recenter(): void;
setReducedMotion(v: boolean | 'auto'): void;       // default 'auto' = matchMedia
setQuality(q: 'high' | 'medium' | 'low' | 'auto'): void;
setDebug(o: { nodes?: boolean; stats?: boolean }): void;
getStats(): { fps: number; drawMs: number; bakedSegments: number; bakedMB: number; quality: string };
on<E extends keyof MapEvents>(e: E, cb: MapEvents[E]): () => void;   // returns unsubscribe
```

`MapEvents = { levelClick(kingdom, level); kingdomClick(id); lockedKingdomClick(); cameraArrived(); walkArrived() }`. The legacy registration methods are thin wrappers over `on()` (see above). Each pointer interaction emits exactly one event (a click is determined at `pointerup` if movement < 5 px, otherwise it is a drag and emits nothing).

`updateProgress(activeMapId, qIndex, starsHistory)` converts to `setProgress`, diffs against the previous progress and, if only the current level moved forward by 1, does nothing visually except update node states (the walk is initiated by `main.ts` via `animateWalkingPath`, as today). If the level jumps (initial load, refresh, history navigation) it teleports the avatar and glides/warps the camera (section 5).

Walking: `animateWalkingPath(waypoints, bubbleText, onArrival)` accepts the polyline `main.ts` obtains from `getStepRef`/`computeWalkPath`. Speed: `clamp(pathLength / 4, 150, 400)` units/s, so a walk is animated at 400 units/s at most; paths longer than 1,600 units are never animated in full (they are shortened by `walkPlan`, 5.4, before reaching the renderer). Foot cycle and dust scale with speed up to 400 units/s. Step sound plays every 24 units but is rate-limited to 6 per second. Bounce and flip are the existing behaviours. `onArrival` fires once (guarded by a token so `destroy()`/`remount()` cannot double fire). If `waypoints` is empty or has one point, `onArrival` fires on the next frame.

Lifecycle: `constructor` creates the DOM, a `ResizeObserver` on the container, `visibilitychange` and `matchMedia('(prefers-reduced-motion: reduce)')` listeners, starts `requestAnimationFrame`. `remount(container)` moves the root, reconnects observers and recomputes the viewport without rebaking. `destroy()` cancels RAF, removes every listener, aborts pending bakes, calls `canvas.width = 0` on every offscreen bitmap, and removes the DOM; it is idempotent.

## 5. Camera, input, transitions

### 5.1 Camera state

`Camera { cx, cy, zoom }` (world point at the viewport centre). `targetCx/cy/zoom` and velocities `vx, vy` for smoothing. Viewport size is the canvas CSS size. `fitZoom = vw / WORLD_W`. **Minimum zoom** `minZoom = max(fitZoom, MIN_READABLE)` with `MIN_READABLE = 0.46` (a 96-unit hit diameter becomes at least 44 px). Maximum zoom 3.2. Default zoom on load (decision): **`defaultZoom = max(minZoom, vw / 1774)` on landscape (`vw >= vh`), and `max(minZoom, 0.55)` on portrait**, so a 390x844 phone views about 709 x 1535 units (about 9 nodes of 165 spacing). Clamp: after every update `cx` in `[vw/(2z), WORLD_W - vw/(2z)]` and `cy` in `[vh/(2z), WORLD_H - vh/(2z)]` (no empty margins, same rule as today). If the visible width exceeds the world width (large ultrawide at min zoom), `cx = WORLD_W/2`.

### 5.2 Follow camera (eased upward)

- **Walking follow**: each frame `cam = cam + (target - cam) * (1 - exp(-dt * 8))` where `target.cx = avatar.x` and **`target.cy = avatar.y - 0.12 * vh / zoom`**. World y grows downward, so the camera centre sits 12 percent of the viewport height **above** the avatar: the avatar appears slightly below the screen centre and the path ahead (upward) is visible. This reproduces the existing 0.12 lerp feel but is frame-rate independent. `camera.test.ts` case: avatar at y = 5000, vh = 800, zoom 1 gives target cy = 4904; at zoom 0.5 the target cy is 4808.
- **Glides** (level change, recenter, kingdom travel): ease-in-out cubic from the current to the target position and zoom. Duration `clamp(distanceInViewportHeights * 450 + 500, 600, 1200)` ms for ordinary glides, 2800 ms for kingdom travel. Because the peak slope of ease-in-out cubic is 3 x distance / duration, an ordinary glide of up to 2.5 viewport heights moves at most about 3 * 2.5 vh / 1.2 s = 6.25 vh/s = 0.104 vh/frame at 60 fps (speed grows with distance and the duration clamp at 1.2 s makes 2.5 vh the worst case), under the 25% per-frame limit (AC16). `camera.test.ts` simulates this.
- **Warp** for large distances: if the glide distance exceeds 2.5 viewport heights (recenter from far away, refresh restore), the camera does not scroll through everything. It fades the overlay to opaque in 120 ms, jumps, and fades out over 220 ms (about 340 ms total; satisfies AC18's 1 s from any position and the 25% frame rule). Reduced motion uses the same warp with 80 ms/70 ms.
- User input cancels any glide that is not input-locking. During input-locked sequences (kingdom transition, walks started by the flow) user input is ignored (`isInputLocked()` returns true).

### 5.3 Look-around

Implemented with Pointer Events on the canvas (single code path for mouse, pen, touch), `touch-action: none`:

- Drag: pointer capture, 5 px threshold (existing). Pan inertia: velocity from the last 80 ms of samples, decays `v *= exp(-dt * 5)`; stops under 5 units/s.
- Wheel: plain wheel/trackpad scroll pans vertically (`deltaY / zoom`) and horizontally with `deltaX`; `ctrlKey` (trackpad pinch emits it) zooms, nothing else does; zoom factor `exp(-deltaY * 0.0015)` anchored at the cursor. `preventDefault` with a non-passive listener on the canvas only.
- Pinch: two active pointers; zoom ratio = distance ratio, anchored at the midpoint; pan follows midpoint movement. Pinch end resumes with no inertia.
- Keyboard (canvas focused): arrows pan 120 units (shift 360), PageUp/PageDown pan one viewport, `+`/`-` zoom, `Home` recenter, `Enter` on a focused node proxy activates it.
- Recenter control: a DOM `<button class="vq-recenter" aria-label="Recenter on current level">` with an inline SVG icon (target/crosshair) added to `src/icons.ts` style (the SVG string is defined in `MAP/src/hud/icons.ts` to keep new files in MAP, same style as `src/icons.ts`, no emojis). It is always present; it gets the `is-emphasis` class (pulsing ring, disabled under reduced motion) when the current node is outside the viewport by more than 20%. Clicking calls `recenter()` which glides or warps per 5.2 and resets zoom to `defaultZoom`.

### 5.4 Kingdom transition (end of the last available level; level 45 in the full game)

The existing flow keeps its phases (`awaiting_kingdom_click -> kingdom_enter_anim -> kingdom_active -> walking_to_question -> star_celebration`). Decision: the new top gate, banner and camera travel are **stage A** of the existing "NEW KINGDOM UNLOCKED" step, and the click-to-enter padlock is **stage B** (NFR-9, unchanged semantics). Sequence triggered by `main.ts` calling `animateWalkingPath` with the polyline produced by `walkPlan` for `buildKingdomTransitionAction`.

**`walkPlan(from, to)` (pure, `core/walkPath.ts`; finding 3)** returns `{ points, warpAfterIndex?: number }`. `from` is the node the avatar is on, which is level 45 in the full game and the **last available level** (for example 5) when the backend serves fewer questions. Let `L` = spine arc length from `from` to the gate front. Rules:
- `L <= 900` units: animate the whole path (normal case from level 45, `L` about 200).
- `L > 900` (the 5-question shipping scenario, `L` about 5,000): the avatar walks the first **two node hops** along the spine (about 2 x 170 units), then the camera/avatar **warps** (120 ms fade out, jump to the gate front, 220 ms fade in; reduced motion 80 + 70 ms) and the avatar continues the last 200 units to the gate. `warpAfterIndex` marks the jump so `animateWalkingPath` treats the gap as a teleport, not a segment (it is excluded from the "no segment longer than 400" bound and from step sounds). Total animated walking distance is therefore at most about 900 units at at most 400 units/s, about 2.5 s, sound rate-limited as in section 4.
- The same `walkPlan` is used by `buildKingdomTransitionAction` in `mapFlowController` and by the demo.

1. Input lock on. Avatar walks per `walkPlan` to the gate front. Camera follows (5.2).
2. Gate animation (900 ms): two cube gate doors slide apart, light shaft glow ramps up (additive blend), 12 sparkle particles, `hooks.gateOpen()` (the factory maps it to `playPadlockUnlock`, section 4 table). Padlock on the gate (if one is drawn) dissolves.
3. Avatar steps through the gate and fades (300 ms).
4. **Title banner** (DOM, 2500 ms visible, 350 ms in and out): kingdom name (Quicksand 700, at least 28 px), subtitle, a 6 px bar in the kingdom colour, over a frosted dark gradient strip across the upper third. Under reduced motion it fades only.
5. Concurrently with 4 (starting 400 ms after it appears) the camera glides up (2800 ms, ease-in-out, or warp under reduced motion) to the next kingdom's **entrance arch** and the avatar reappears at the entrance (just below L1).
6. Banner leaves, `cameraArrived` and `walkArrived` fire, input unlocks. The map is now in `awaiting_kingdom_click` for the next kingdom: its entrance arch carries the dark mist + 3D padlock (existing look), the "NEW KINGDOM UNLOCKED!" toast, and the click on the arch triggers `playKingdomEntryAnimation` (padlock 850 ms unlock, 1.5 s zoom, fade) then dialogue and the question screen, exactly as today.

Kingdom 3 has no next kingdom: after level 45 the avatar walks up the capitol steps, flags and confetti-like sparkles play (reuse existing star particles), no gate and no banner (the existing completed screen takes over). This repeats 1 -> 2 -> 3 (AC19).

Kingdom click target (replacing `kingdoms[]` rectangles): an entrance arch/sign object per kingdom (K1: the "I (heart) EPCES WELCOME" sign near L1; K2: "Bayan ng Prosperidad" plaza arch; K3: "Provincial Capitol" grand arch), each with a world-space hit rect of at least 320x200 units (`EntranceRecord.hit`, 3.2).

**Gating rules (pass 4, finding 3).** `setMapFlowOptions({activeMapId, enteredKingdomIds, mapPhase})` stores the options; every rule below reads the stored values at event and draw time. These port `game2d.ts` (`unlocked = k.id <= activeMapId`, `clickable = unlocked && !entered`) and are the single definition used by hit-testing, drawing and the camera:

| Predicate / rule | Definition |
|---|---|
| `unlocked(k)` | `k <= activeMapId` (replaces the undefined `isKingdomProgressUnlocked`) |
| `entered(k)` | `enteredKingdomIds.includes(k)` |
| Entrance hit (`EntranceRecord.hit` of kingdom k) | if `unlocked(k) && !entered(k)`: emit `kingdomClick(k)` and call `hooks.click`. If `!unlocked(k)`: emit `lockedKingdomClick` and call `hooks.wrong`. If `entered(k)`: nothing (no event, no sound) |
| Node hit (node n of kingdom k) | emit `levelClick(k, level)` and call `hooks.click` only if `entered(k) && n.available && (n.status === 'completed' \|\| n.status === 'current')`. Otherwise call `hooks.wrong` and emit nothing (locked, unavailable, or kingdom not yet entered) |
| Mist and padlock | while `!unlocked(k)`: mist over the kingdom's lower half (entrance region and everything above it that is on screen) and the padlock on the entrance. While `unlocked(k) && !entered(k)`: the padlock is drawn on the entrance only, no mist. While `entered(k)`: neither |
| `mapPhase === 'awaiting_kingdom_click'` | `centerOnActiveLocation()` calls `centerOnKingdom(activeMapId)`, which centres on `EntranceRecord(activeMapId).hit` (glide or warp per 5.2). Any other phase centres on the current node |
| Walks | `animateWalkingPath` is allowed regardless of `entered`; only user clicks are gated |

## 6. Procedural generation pipeline

### 6.1 Determinism (NFR-8)

`mulberry32(seed)` is the only RNG. Seeds: `kingdomSeed = [0xA11CE, 0xB0B, 0xCAFE][k-1]`, per-segment seed `hash(kingdomSeed, n)`, per-object seed `hash(segSeed, objectIndex)`. No `Math.random`, no `Date.now` inside generation. Generation iterates objects in a fixed order. Output depends only on the data files, so screenshots compare across devices.

### 6.2 Generation stages (per segment, run lazily, results cached)

1. **Heightfield** `H[i][j]` for the segment's cells (plus a 4 cell margin so objects crossing seams are consistent): world-space value noise (octaves 3, cell sizes 14, 6, 3 cells), quantised to levels 0..5, kingdom tint and terrain amplitude. World-space sampling guarantees seamless tiling because both neighbouring segments sample the same noise function at identical world cells.
2. **Carve**: path cells set to the path plateau height (smoothed over 3 cells, steps of at most one level so the path stays walkable), river cells to level -1 (water), bank cells get stone/dirt materials, waterfall steps are placed where the river crosses a height drop of at least 2 levels.
3. **Zone materials**: grass (kingdom palette), dirt, stone, cobblestone (path, 2-tone brick pattern 9x5 units), sand edge, water.
4. **Object scatter** (Poisson-disc with seeded RNG): trees, bushes, flowers, fences, rocks, lily pads, hill pyramids, parked vehicles. Rejection rules: not on path (within `PATH_CLEAR` = 70), not on water, not inside landmark footprints, min distance by type.
5. **Landmarks** from the scene scripts, placed at fixed coordinates with footprints.
6. **Bake** (section 9): ground + materials + landmarks + flat decor (flowers, fences, rocks) into the segment bitmap. Trees, bushes, lamp lights, flags are exported as the dynamic object list.

### 6.3 Seamless tiling inside a kingdom

- Terrain noise and path carving are functions of world coordinates only (stage 1 and 2).
- Each segment bake draws a **64 unit bleed** above and below (objects whose bounding boxes overlap `[segTop - 64, segBottom + 64]` are drawn, clipped to the canvas), so a rock or fence crossing a seam is drawn identically in both. Bitmaps are exactly 1774x887 units; nothing is resampled at the seam.
- Bitmaps are blitted at integer device-pixel positions: `x = round((segX - camLeft) * zoom * dpr)` and the blit height is rounded and extended by 1 device pixel (`+1` overlap) to remove hairline gaps (AC10).
- Landmarks never straddle a segment boundary by design (scene scripts enforce `footprint within one segment` except the colonnade and rivers, which use the bleed rule).

### 6.4 Kingdom seams (sky gate band)

Each kingdom's top 330 units (`u > 5879`, gate arch at `TOP_GATE_U = 5850`) are the **sky gate zone** of S7, and the bottom 330 units of S1 (`u < 330`) of the next kingdom are the **cloud stairs** arrival zone. At the K(k)/K(k+1) boundary they meet: the horizon (hills of small 12-unit cubes) fades into a gradient sky (kingdom tint to light blue) with two near clouds, then a field of cube-cloud islands, then cloud stairs leading up to the next entrance arch, whose island is grass. Both zones are drawn by deterministic code and share the same boundary palette so there is no visible seam. For K1 S1 (bottom of the world) the bottom edge is regular terrain, and for K3 S6 the top is sky with far hills and the finale.

## 7. Sprite and asset generation (voxel landmarks)

### 7.1 Approach: runtime voxel rasteriser, no shipped bitmaps

Decision: every sprite is generated at runtime from compact **voxel models** and rasterised to small offscreen canvases by one function, `rasterizeVoxelModel(model, palette, projection, lightMode) -> HTMLCanvasElement`. This gives consistent cube/lighting rules (section 2.3), per-kingdom palette swaps, tiny shipped size (code only, well under 3 MB, NFR-6), and no asset pipeline. Costs: some start-up CPU time, mitigated by lazy, idle-sliced rasterisation and in-memory caching (about 40 distinct sprites). A developer script `npm run map:atlas` writes the generated sprites to `MAP/reference/compare/atlas/*.png` for QA only (not shipped).

`VoxelModel = { name, size: [w,d,h], layers: string[][] (char grid per height level), legend: Record<char, MaterialId>, anchor: [ax, ay] }`. Models are authored in `MAP/data/models/*.ts` as ASCII layers (compact and diffable). Materials: `{ base: '#hex', top?: '#hex', noise: 0..1, emissive?: boolean }`. Faces are drawn back-to-front; only exposed faces are drawn (a voxel hidden by neighbours in front and above is skipped); the result is a canvas of `(w*18) x (d*10 + h*14)` units at the sprite scale chosen by `quality`.

### 7.2 Sprite catalogue

Kingdom 1 (reuses all reference landmarks, authored to match the image):
- `school`: 30x12x14 voxel main hall with an L-wing, green tile roof (alternating two greens in a 2x1 tile pattern, ridge line), 6 windows with dark-blue panes and white frames, door with steps, wall panel with the school sign.
- `sign_epces`: letters `I`, red heart, `E P C E S` as 5x7 voxel letter models (palette: blue, red, green, orange, yellow-orange, pink-red, as in the image) on a dark wood planter, plus `WELCOME` green plaque (voxel letters on cream). Text on the school ("DepED", "EAST PROSPERIDAD CENTRAL ELEMENTARY SCHOOL", "SCHOOL ID: 10-135STS") and on the hall and capitol plaques is drawn with **canvas text** (MinecraftTen bold, loaded via the existing font) onto the front face with a slight skew; if the font is not ready it falls back to `700 Quicksand` and the sprite is re-rasterised once on `document.fonts.ready` (FR-13: real text, not copied bitmaps).
- `hall`: round colosseum: 34x26 voxel ring with 2 tiers, tan wall, brown roof band, blue columns (8 visible), green-roof entrance block with gold crest, steps, navy windows. Plaque "BAYAN NG PROSPERIDAD" and emblem (concentric-circle crest drawn procedurally).
- `capitol`: 40x12x16 hall with red clay tile roof (2 reds), central pediment with crest, 6 columns, windows, steps, "PROVINCIAL CAPITOL" plaque; flag poles: Philippine flag (blue/red field, white triangle, three yellow stars and sun, drawn from geometry on a canvas) and two yellow flags (flag banners are separate dynamic sprites, see section 8).
- `playground`: tower with green pyramid roof, slide, `lamp_post` (with a warm glow sprite), `van_white`, `car_red`, `suv_dark`, `fence_wood` (tileable 1x1x1), `bridge_wood` (planks and rails), `bush`, `bush_flowers` (3 flower colour variants), `tree_oak` (3 variants: width 5 to 7 voxels, trunk 2x2, canopy 3 layers with highlight/shadow noise), `hill_pyramid` (stepped 9-layer pyramid with cube trees on it), `rock_stone` (gray cluster), `lily_pad`, `waterfall_step`.

Kingdom 2 (municipal town, distinct biome): palette shift to warm tan and teal; `town_arch` entrance, `market_stall` (3 colour awnings), `fountain` (animated water drips), `lamp_post` (more), `banner_string` (fiesta pennants), `bench`, `stone_bridge` (arched), `lake_pier`, `hall_annex`, `colosseum` hero (the K2 top-gate landmark, larger than the reference hall at 1.4x), `palm_tree`/`acacia` variants, `reed`, `boat`. Lake: wide water (rect lists), more bridges.

Kingdom 3 (highland estate): palette shift to cooler greens and gray stone; `capitol_arch`, `colonnade` (repeatable bay), `terrace_wall`, `cypress`, `monument_obelisk`, `vehicle_suv/van` re-skins, `cliff_edge` (stone cube cliffs with surf cubes), `lighthouse`-style `belvedere`, `capitol_grand` (summit, 1.6x the reference capitol with a dome-like cupola, flags), `statue`. The summit uses the same flag animation.

Each kingdom changes: grass top/front colours (K1 `#5aa63c/#3e7f2b`, K2 `#7bb04a/#587f35` warm, K3 `#4f9a5a/#2f6e42` cool), sky tint (K1 `#2f9fe8 -> #8fd0f5`, K2 `#4aa8d8 -> #bfe6ef` teal, K3 `#5b8fd9 -> #cfd8f2` with golden horizon), hill silhouette (K1 pyramids, K2 flat-topped mesas, K3 tall conical peaks), tree mix, and landmark set (FR-6). Cube size, outline, lighting and noise are identical across kingdoms.

### 7.3 Terrain materials

Grass top: base + noise tiles (4 tone variants) with sparse darker/lighter cube-tops; dirt: brown with pebble dots; stone: gray with the reference's mix of 3 grays at random cube granularity; cobblestone path: cream `#e8d5a0` with 9x5 unit brick pattern and a darker mortar line, with edge cubes in sand; water: 3 blues `#2f80d8 #4aa0e8 #7cc4f2` in a cube grid with 1-unit white-blue gaps lines.

## 8. Effects: implementation table

All animated effects use a global animation clock `t` (seconds, advanced by clamped `dt <= 0.05`). With reduced motion on, `t` for world layers is frozen at 0 (frames identical, AC13). Quality tier column: H = high, M = medium, L = low.

| Effect | Implementation | Quality notes |
|---|---|---|
| Water flow and shimmer (FR-16) | Each segment exports `waterRects: Rect[]` (cube-aligned). A cached `CanvasPattern` from a 144x144 shimmer tile (4 frames, white-blue glint cubes on transparent) is filled into each visible rect with `pattern.setTransform` scrolled `(t*14, t*6)`; frame index = `floor(t*6) % 4`. At most ~60 rects per segment; `fillRect` per rect. Rects are also clipped to the viewport before drawing. | H 6 fps frames + scroll; M 3 fps; L 1 frame, no scroll |
| Waterfalls | `fallRects`: vertical rect list. A 18x64 stripe pattern (white/light blue/blue) scrolls downward at 140 units/s; mist: 3 puff sprites at the base alpha-pulse (0.25 to 0.55) and drift. | L: no mist |
| Clouds (FR-17) | Cloud sprites are block-cloud models (6 large + 14 small variants) rasterised once. Far layer parallax 0.3 (drawn behind terrain, visible only in the sky gate zones and cloud-stair zones), near layer parallax 1.15 drifting at 6 to 14 units/s with wrap in x. Cloud placement is deterministic per kingdom (`cloudField(k)`), with a dense field in the sky gate zone and in the slow background layer. | H 18, M 10, L 4 clouds per viewport |
| Flags (FR-18) | Flag banners (Philippine, yellow) are 48x32 canvases cut into 12 vertical slices; per frame each slice is drawn with `y offset = sin(t*4 + sliceIndex*0.6 + phase) * amp * sliceIndex/12` and a brightness tint from the wave slope. Poles are in the landmark bake; flags are dynamic objects anchored to pole tops. | L: static |
| Trees and bushes sway (FR-19) | Trees and bushes are dynamic sprites drawn depth-sorted. Transform: `rotate` about the trunk base by `sin(t*1.3 + phase) * 0.012 rad` (bushes 0.02) plus a canopy-only skew via two draws (trunk static, canopy rotated) so the trunk stays planted. Phase from the object seed. | H all in view; M all but amplitude halved; L no sway (sprites still drawn) |
| Lamp and window glow | Lamp: additive radial gradient sprite (cached) with alpha `0.55 + 0.15 sin(t*2)`. Hall and school windows: a cached additive glint tinted by kingdom colour, slow pulse. | L: static glow |
| Waving cloth, banners (K2 pennants, K3 pennants) | Same slicing method as flags | |
| Node sparkles (FR-20) | Per node (current and nearest unlocked), 3 star-shaped particles orbiting, pooled arrays (no allocation), `globalCompositeOperation: 'lighter'` | M 2, L 0 |
| Hover glow | sky-blue (`#7dd3fc`) 3-unit outline around the node cube, alpha 0.9, plus tooltip (DOM) and `hooks.hover()` (section 4 table; same trigger points as `game2d.ts`) | |
| Current node | pulsing golden outline (`sin(t*4.5)`), bouncing arrow above (sine 8 units), speech bubble "n. Station" | |
| Completed node | emerald outline (`#10B981`), 1 to 3 candy stars underneath using the existing star drawing (port the function; same colours) | |
| Locked node | desaturated (`filter`-free: pre-rasterise a grey variant sprite), alpha 0.55, small lock glyph | Unavailable ("coming soon", FR-30): same plus dashed outline and tooltip "Coming soon" |
| Ambient sparkles and sun glow (FR-24) | Sun: large soft radial gradient anchored to the viewport top-left in screen space (cheap, cached gradient, additive 0.18). Floating sparkles: pooled particles drifting up and fading in world space around the viewport | H 40, M 25, L 10 (existing counts) |
| Run dust, foot cycle, bounce, flip, bubble | Port of existing avatar code (same constants), generalised to long paths | |
| Locked kingdom mist and 3D padlock | Port existing `drawKingdomMist` / padlock; mist drawn as a gradient over the entrance region and the whole locked kingdom area above the gate when the camera is in it (alpha 0.55) | |
| Gate animation | Doors slide (ease-out), additive light shaft, particles | reduced: instant open + fade |

Per-frame allocation rule: all particle pools, path arrays, sorted object arrays, gradients and patterns are created once (or on resize/quality change) and reused. The draw-order list is a preallocated array re-filled by merging per-segment y-sorted object lists (O(visible)) with the avatar inserted by binary search.

## 9. Performance strategy (NFR-1, NFR-2)

### 9.1 Baking

- **Segment bake** `bakeSegment(segId, scale)` draws a segment's static content into an `OffscreenCanvas` (fallback `document.createElement('canvas')`) of size `1774*scale x 887*scale`, with `scale = clamp(round2(dpr * defaultZoom), 0.75, tierCap)` where `tierCap = {high: 2, medium: 1.5, low: 1}`. A canvas at scale 2 is 3548x1774, under the 4096 limit, 25 MB. The bake is **row-sliced** across several `requestIdleCallback`/`setTimeout(0)` ticks (12 ms budget per tick) so a bake never blocks a frame for more than about 12 ms. Total bake time per segment is expected at 80 to 250 ms on mid devices.
- **Prebake window and budget (finding 7)**. Pure function in `render/bakeBudget.ts`: `segBytes(s) = 1774*887*4*s^2` (6.29 MB at s=1, 14.2 MB at 1.5, 25.2 MB at 2). `visibleMax = ceil(viewH / (minZoom*887)) + 1` (a 768x1024 portrait tablet at minZoom 0.46 gives `ceil(2226/887)+1 = 4`). `maxBaked = visibleMax + 2` (visible + 1 ahead + 1 behind). `BAKE_BUDGET = 120 MB` (sprites 10 MB and placeholders 1 MB bring the total under AC21's 150 MB). `bakeScale` = the largest of `{2, 1.5, 1, 0.75}` that is `<= tierCap`, `<= dpr * defaultZoom` rounded up to the next step, and satisfies `maxBaked * segBytes(scale) <= BAKE_BUDGET`. Examples: phone 390x844 (`visibleMax = ceil(844/0.46/887) + 1 = ceil(2.07) + 1 = 4`, `maxBaked = 6`): scale 1.5 = 6 x 14.2 = 85 MB (scale 2 = 6 x 25.2 = 151 MB exceeds the budget); tablet (maxBaked 6): 1.5 = 85 MB; desktop 1080p at fit zoom (visibleMax 3): 1.5. Eviction rule: **visible segments are never evicted**; the prefetch segments (ahead, behind) are dropped first, then least-recently-visible; the prefetch is skipped while `bakedCount >= maxBaked`, so a scroll cannot bake-evict-bake. Eviction frees the canvas (`width = 0`). Unit tests cover `visibleMax`, `maxBaked`, `bakeScale` for six viewports and assert `maxBaked * segBytes <= BAKE_BUDGET` and `maxBaked >= visibleMax`. The demo reports `bakedMB`.
- **Placeholder**: while a segment is unbaked, a cheap placeholder (a 1/8-scale quick bake of heightfield colours, kept permanently for all 21 segments = 21 x 222x111x4 = 2.1 MB) is drawn upscaled, so the user never sees a hole. First interactive paint needs only the placeholder + the current segment bake (queue priority: current, then neighbours by distance from camera velocity direction).
- **Sprite cache**: all voxel sprites rasterised once per quality tier at `spriteScale = scale`, held in a `Map`. About 40 sprites, under 10 MB.
- **Rebake triggers**: DPR change, quality change (debounced 500 ms), never on zoom (zoom beyond the bake scale just upscales with smoothing on; terrain looks slightly soft above 1.5x, vector overlays and text stay crisp; accepted limitation, listed in section 15, D5).

### 9.2 Culling and per-frame cost

- Visible segment indices come from the camera rectangle: `[floor(top/887), floor(bottom/887)]` (1 to 3 segments). Objects (trees, bushes, nodes, flags, rects) are stored in per-segment arrays sorted by y; drawing iterates only the visible segments' arrays and rejects by an AABB test against the view rect expanded by 64 units. Nothing iterates all 135 nodes or all trees per frame; hit-testing and nearest-node look-ups use the visible segments' nodes only (the full 135 node list is used by status and `getNodePosition` only).
- **The figures in this subsection are estimates, not measurements** (finding 12). Milestone 0 ("perf spike") is mandatory before K2 and K3 are built: with K1 S1 plus three procedural neighbour segments, record frame time, draw ms, bake ms and baked MB unthrottled and at 4x CPU throttle, on desktop Chrome and one mid Android device if available. Measured at 1366x768 with the camera at K1 L20 (a mid-world position with three segments visible). **Gate (pass 4, finding 2; identical to AC20 so the spike guards the acceptance line)**: unthrottled frame work (JS + draw) <= 4.5 ms, and at 4x CPU throttle >= 55 fps on `medium` and >= 30 fps on `low`. (4.5 ms x 4 = 18 ms = 55.5 fps; a looser unthrottled figure such as 10 ms would give 25 fps at 4x and fail AC20.) If the gate fails, this design is revisited (smaller bake scale, fewer dynamic sprites) before any further work.
- Expected per-frame budget on a 4x throttled desktop Chrome at 1366x768: 3 `drawImage` of segments (~0.5 ms), about 40 water/fall `fillRect` (~0.5 ms), about 150 sprite draws (~1.5 ms), overlays (~0.5 ms), JS about 1 ms: about 4 ms, throttled 4x = 16 ms. If measured worse, the adaptive governor lowers quality.
- **Adaptive governor**: an EMA of frame time over 2 s; above 22 ms drops one tier (H -> M -> L), below 12 ms for 10 s may raise one tier back only once (hysteresis, no oscillation). Tier changes trigger the debounced rebake of bake scale. `getStats()` exposes this.
- **DPR** (NFR-2): canvas backing store `round(cssW * d)` with `d = min(devicePixelRatio, tier === 'low' ? 1 : 2)`, CSS size set via style, `ctx.setTransform(d, 0, 0, d, 0, 0)` once per frame; the segment bitmaps are drawn with `imageSmoothingEnabled = true` (`imageSmoothingQuality = 'low'`) when `bakeScale*zoomRatio` is not an integer, and `false` for exact integer ratios. Text and node cubes are vector drawn at device resolution, so they are crisp at DPR 2 (AC11).
- **Loop control**: RAF paused when `document.hidden` or when the container is not connected/visible (IntersectionObserver); on resume `lastTime = now` (no time jump) and `dt` clamped to 50 ms (existing).
- Device tier detection reuses the logic of `detectDeviceCapabilities` in `game2d.ts` (copy of the thresholds into `MAP/src/quality.ts`; do not import from `game2d.ts` so the module stays standalone for the demo), plus `navigator.deviceMemory <= 4` forces `medium` at most.

### 9.3 Prefers-reduced-motion (NFR-4)

- `matchMedia('(prefers-reduced-motion: reduce)')` is read at construction and subscribed; `setReducedMotion` overrides.
- When on: world clock frozen (water, falls, flags, sway, clouds, sparkles, gate shaft), no inertia, camera glides replaced by warp fades of at most 150 ms (80 ms + 70 ms) or instant moves, banner fades without slide, node pulse replaced by a static thicker outline. The avatar still moves along the path logically: the walk completes in at most 600 ms (fast step, no foot cycle), `onArrival` always fires, so game logic does not stall.

## 10. Input and status details for the existing flow

- Node hit radius in world units: `max(48, 22/zoom)`, i.e. at least 44 px diameter on screen (FR-12). Hit tests run on the visible segments' nodes only, nearest first. The exact click, wrong-sound and event conditions for nodes and kingdom entrances are the gating table in 5.4 (nodes of an un-entered kingdom never emit `levelClick`; locked, unavailable and un-entered nodes call `hooks.wrong`, no event). Completed and current nodes of an entered kingdom: `levelClick(kingdom, level)` plus `hooks.click` (the legacy `onStepClick(mapId, qIndex)` gets `(kingdom, level)`).
- Overlap rule: at `zoom = 0.46` the radius is 48 and neighbouring nodes can be 90 units apart, so hit areas overlap slightly. The **nearest node centre within the radius wins**; ties go to the lower `globalIndex`. Tested in `camera.test.ts`/`layout.test.ts` with two nodes 90 apart.
- Hover: tooltip with `station` name (the same wording as today for the 15 original nodes, and generated names `"<Kingdom> - Level n"` for the rest) and `hooks.hover()` once per entry. Walk steps call `hooks.step()`.

## 11. Accessibility

- Canvas: `role="application"`, `aria-label="Vocab Quest world map. Use arrow keys to look around, Home to recenter."`, `tabindex="0"`.
- Proxies: up to 24 `<button class="vq-node-proxy">` for the nodes in the viewport, absolutely positioned over the canvas, visually transparent (a `:focus-visible` ring is drawn on the matching canvas node and the button gets a 2 px outline), `aria-label="Level 37 of 45, Kingdom 1, completed, 3 stars"`; `aria-disabled` for locked/unavailable. Tab order is bottom-to-top. Focusing a proxy scrolls the camera to it (glide).
- Live region announces "Level N of 45 in <kingdom>" when the current level changes (once per change, throttled to 1 s).
- Contrast: node number glyphs are white on `#c2406a` (ratio ~5.2:1 measured against the cube front face colour; if the pink front face is lightened by the sparkle/hover effects, the number gets a 2 px dark `#6b1030` stroke) satisfying 4.5:1.
- HUD text is Quicksand, at least 16 px. Tooltip and banner text have a minimum 4.5:1 contrast against their dark glass backgrounds. This does not constitute WCAG validation; manual assistive-technology review is still required.

## 12. HUD (`MAP/src/hud/`)

DOM overlay inside `vq-map-root`, namespaced classes `vq-*`, own stylesheet `MAP/src/hud/hud.css` imported by the TS entry (Vite handles CSS imports; `vite/client` types already included via tsconfig). Components:

- Progress chip (top centre, below the existing "PROSPERIDAD MAP" pill and clear of the player card): "Level 37 / 135" and "Kingdom 1: 37/45". `aria-hidden` (the live region is the accessible source).
- Recenter button (bottom right, safe-area insets via `env(safe-area-inset-*)`), 48x48 px.
- Kingdom mini-indicator (right edge, vertical, three dots K1 K2 K3 with the current highlighted, tap to glide to that kingdom's entrance if unlocked; hidden below 360 px width).
- Tooltip and title banner.
- The existing HUD in `WorldMapScreen.ts` (player card, MENU) is untouched.

## 13. Folder layout (everything new is under `frontend-game/MAP`)

```
MAP/
  README.md                 purpose, run, API, data format, regenerate, perf, backend follow-ups (REQUIREMENTS 8), limitations (must list: K1 S1 is not the full reference frame because its top 130 px sky band is ground, D4, with sky and clouds shown in the K1 S7 gate zone; the top 180 units of K1 S1 read flatter than the reference, 14.0 step 5; terrain softness above 1.5x zoom, D5)
  PLAN.md                   milestones and task breakdown (next pipeline step)
  reference/                vocab-quest-map.png (untouched), compare/ (screenshots, not shipped)
  data/
    world.ts spines.ts nodes.ts(generated) gates.ts(generated)
    scenes/k1.ts k2.ts k3.ts
    models/ school.ts sign.ts hall.ts capitol.ts props.ts trees.ts k2-*.ts k3-*.ts letters.ts
  src/
    index.ts                public exports + createMapRenderer factory + feature flag
    VoxelWorldMap.ts        the component (orchestration, public API)
    api/types.ts            MapRenderer, events, progress types
    core/                   rng.ts, layout.ts, status.ts, walkPath.ts, camera.ts, quality.ts, math.ts   (no DOM)
    gen/                    heightfield.ts, carve.ts, scatter.ts, segmentScene.ts
    raster/                 voxelRaster.ts, materials.ts, spriteCache.ts, text.ts, flagSprite.ts
    render/                 bake.ts, bakeQueue.ts, frame.ts, layers/{sky,clouds,water,objects,nodes,avatar,overlays}.ts
    input/                  pointer.ts, keyboard.ts
    hud/                    hud.ts, hud.css, icons.ts, banner.ts, a11y.ts
    flow/                   flowAdapter.ts (step refs, global level numbering, transition paths for mapFlowController)
  tools/                    generate-nodes.ts, export-atlas.ts, check-checklist.md (visual checklist)
  demo/                     index.html, main.ts, demo.css, vite.config.mjs
  tests/                    unit tests (vitest) + types.test-d.ts; vitest.config.mjs and tsconfig.tools.json sit in MAP/
  (src/flow/ also holds flowMode.ts and kingdomMap.ts; src/render/ also holds bakeBudget.ts)
```

Build graph (NFR-7, finding 11): verified that `node_modules/@types` does not exist and `tsconfig.json` has `types: ["vite/client"]` and `include: ["src"]`. `frontend-game/tsconfig.json` `include` changes to `["src", "MAP/src", "MAP/data", "MAP/demo/main.ts"]` (explicit files, so no Node-typed config is type-checked by `tsc`). Demo and test configs are plain ESM JavaScript, not TypeScript: `MAP/demo/vite.config.mjs` and `MAP/vitest.config.mjs` (they use `node:url`/`node:path`, which `tsc` never sees). `MAP/tests` and `MAP/tools` get `MAP/tsconfig.tools.json` (extends the root config; `types: ["vite/client","node"]`; adds the `@types/node` dev dependency, pinned to the current major supported by the repo's Node, and vitest) run by `npm run map:test` as `tsc -p MAP/tsconfig.tools.json --noEmit && vitest run`. They are not part of `npm run build`. The demo is not part of the production bundle.

## 14. Standalone demo (FR-34)

`MAP/demo/index.html` + `main.ts` + `vite.config.mjs` (root `MAP/demo`, `server.fs.allow` the parent, **no path alias**). `demo/main.ts` uses **relative imports only** (`../src/VoxelWorldMap`, `../src/api/types`, `../data/...`), so the root `tsc` run (which includes `MAP/demo/main.ts`, 13) resolves them with no `paths` entry and Vite needs no `resolve.alias` (pass 4, finding 7; chosen over adding `paths` because it adds no configuration to the shared root tsconfig). Run: `npm run map:demo` = `vite --config MAP/demo/vite.config.mjs` (script added to `package.json`). No backend is contacted; the avatar image is `/assets/explorer_boy.png`-style assets served from `public/` via `publicDir: '../../public'`.

Controls (a DOM panel on the left, collapsible, keyboard operable): kingdom picker (1 to 3), level picker (1 to 45), "Jump" (calls `setProgress` immediately), "Complete level" (random stars 1 to 3 appended to history, calls the same `animateWalkingPath` + `setProgress` flow as production through `flowAdapter`; at level 45 the full gate/banner/travel sequence runs, then it auto-"clicks" the entrance, which is the same call `main.ts` makes), "Reset", "Recenter", reduced-motion toggle (`setReducedMotion`), quality select (high/medium/low/auto), availability slider (`total_questions` 1 to 45, to test FR-30), debug overlay toggle (draws all 135 node circles, ids, segment borders, culling rectangles, baked segment tinting), avatar picker, FPS/draw-ms/baked-MB readout from `getStats()`. The demo uses only the public component API.

### 14.0 Fidelity protocol (finding 5)

The reference comparison is a numbered, repeatable protocol, run on K1 S1 only, and is the gate of milestone 1 (nothing for K2/K3 is built until it passes):

1. **Capture**: the demo has a hidden `?compare=1` mode that renders K1 S1 at exactly 1774x887 CSS px, DPR 1, fit zoom, with the avatar and HUD hidden, and offers an overlay slider (0 to 100 percent opacity of `reference/vocab-quest-map.png`) for visual alignment. The compare mode is the only place that loads the reference PNG (dev only; the production guard test excludes `demo/`).
2. **Landmark boxes**: the implementer measures the bounding boxes of the 11 table entries in 3.4 plus the 4 largest waterfalls and 2 yellow flags plus the Philippine flag on the reference and commits them as `tools/reference-boxes.json`. Gate: every rendered box is within **24 units** of the reference on each edge (half of a 48-px metric block); nodes L1 to L13 within **12 units** (AC3).
3. **Image metric** (pass 3, finding 2): `tools/compare.ts` takes a Playwright screenshot of the compare render and the reference, divides both into **48x48 pixel blocks** (a 37 x 19 grid; edge blocks are partial), averages RGB per block and converts to CIELAB. The block size (48) is deliberately 2x the box tolerance (24), so a landmark edge that is within tolerance cannot fail a whole block. Gate: at least **75 percent of blocks** with deltaE76 < 14, **and** the mean deltaE76 over all blocks < 12. The metric is a secondary gate; the box gate (step 2) and the checklist (step 4) are primary. Blocks that overlap the K1 S1 top 130 px band (ground replacing sky, D4) are excluded. **K1 S1 decor placement**: in K1 S1 the seeded Poisson scatter (6.2 stage 4) is **disabled**. Trees, bushes, flowers, hill pyramids, rivers, waterfalls, lily pads, banks and fences are **hand-placed in `scenes/k1.ts`** from reference measurements (a list of about 120 objects with x, y, type, variant), so block colours line up with the reference. Terrain height noise in S1 is limited to +/-1 level outside hand-authored hills, and per-voxel brightness noise stays at +/-5 percent. The result is printed in the README.
4. **Checklist** (below), each of 28 items scored 0 (absent), 1 (present but off), 2 (matches), by the implementer and then the reviewer. Gate: every landmark item (14 to 26) scores 2 and the sum is at least 50 of 56.
5. **Perspective check**: with the band curve (2.3) side by side with the reference, the reviewer confirms the background reads as receding. If it does not, tune the curve minimum (0.78) only; the curve must start and end at 1.0 (seam rule). **Accepted limit (pass 4, finding 6; simplest option, no second tunable)**: because the curve returns to 1.0 at refY = 0 so that S1 tiles with S2, the top 180 units of K1 S1 (where the reference has its smallest cubes and hills) read flatter than the reference. This is not tuned further and is listed in the README limitations.

### 14.1 Reference-match checklist (AC8, at least 20 itemised landmarks), scored in `tools/check-checklist.md`

1 sky gradient, 2 blocky white clouds, 3 pyramid hills, 4 cube trees with highlight/shadow, 5 flowering bushes, 6 blue block-water river grid, 7 waterfalls (>= 4), 8 lily pads, 9 stone/gray banks, 10 dirt banks, 11 cobblestone path, 12 wooden bridge, 13 wooden fences, 14 green-roof school, 15 DepED sign and school text, 16 playground slide + tower (school side), 17 I(heart)EPCES 6 coloured letters + heart, 18 WELCOME plaque on planter, 19 Bayan colosseum with blue columns, 20 gold crest + "BAYAN NG PROSPERIDAD" plaque, 21 lamp post, 22 white van x2, 23 red-roof Provincial Capitol, 24 Philippine flag, 25 two yellow flags, 26 red car + dark SUV, 27 numbered pink cubes 1..13 at the anchors, 28 playground slide at hall. All must be present, with this scoping (pass 3, finding 1): **items 1 (sky gradient) and 2 (blocky white clouds, the reference's 6 large clouds) are scored on the K1 S7 sky/gate zone and the K1/K2 boundary** (the sky gate zone of 6.4, which draws a full sky gradient and a cloud field including at least 6 large block clouds), **not on K1 S1**, because S1's top 130 px is ground so S1 tiles with S2 (D4). The K1 S1 compare render keeps the 2 near clouds over the hills and is not scored on items 1 and 2. All other items (3 to 28) are scored on the K1 S1 compare render.

## 15. Assumptions, conflicts and resolutions

| # | Item | Decision |
|---|---|---|
| D1 | FR-3 "about 7-10 reference heights" | **7 segments per kingdom** (finding 4, option a). FR-3 is met as written; no requirement is amended for this. Spines were lengthened to match (3.3). |
| D2 | The reference's own hops L3->L4 (246) and L8->L9 (207 after the L9 nudge) exceed AC2's 200; the reference's L9-L10 pair (87.5) is below AC2's 90 | AC3 (match reference within 12) wins for the two long hops: they are tagged `hop: 'bridge'` and allowed up to 250. For the short pair, L9 is nudged 5.7 units (3.4) so the 90 floor holds with **no exemption**. All other hops 90 to 200. Test updated accordingly. |
| D3 | AC17 "min zoom = fit width" vs FR-12 (44 px targets, 3 nodes visible on phones) | `minZoom = max(fitWidth, 0.46)`. On desktop landscape this equals fit width; on portrait phones the whole width cannot be shown and the map pans horizontally. The follow camera keeps the path in view. **Amended requirement wordings (finding 8), to be applied to REQUIREMENTS.md by the next step and used by the test author:** (a) FR-9 / NFR-3: "minimum zoom = max(fit-to-width, 0.46) so a node's 96-unit hit area is never smaller than 44 px"; (b) FR-12: "on portrait phones the map is shown at default zoom max(minZoom, 0.55), which shows the path's full width area by panning and at least 3 nodes, never the full world width"; (c) AC17: "after any sequence of zoom/pan inputs, `zoom >= minZoom`, `zoom <= 3.2`, and the viewport lies inside the world"; (d) AC4: "among **available** nodes, every node before the current one is completed, exactly one is current, all later ones are locked; unavailable nodes are locked and never completed or current". Hit testing is "nearest node wins within radius" (section 10). **(e) AC8 (pass 3, finding 1)**: "A K1 Level-1 screenshot at 1774x887 matches the reference on the 26 checklist items 3 to 28 of 14.1 (two near clouds over hills instead of the sky band); items 1 and 2 (sky gradient, white block clouds including at least 6 large clouds) are verified in a screenshot of the K1 sky/gate zone (K1 S7 and the K1/K2 boundary)." |
| D4 | Reference top sky band vs vertical tiling | K1 S1 replaces the top 130 units of sky with ground; sky exists only in the kingdom-gate zones. All other reference elements keep their positions. The README limitations section states that the K1 S1 screenshot is therefore not the full reference frame (pass 4, finding 8). Consequence (pass 3): checklist items 1 and 2 are scored in the K1 S7 sky/gate zone and K1/K2 boundary, and AC8 is reworded (D3 item e). |
| D5 | Zoom above bake scale | Terrain is upscaled and slightly soft above about 1.5 to 2x; node cubes, text, HUD stay crisp. No zoom-dependent rebake (avoids bake storms on pinch). |
| D6 | AC19 sequence vs existing click-to-enter flow | Stage A (walk, gate, banner, camera to next kingdom, auto) then stage B (click the entrance: padlock unlock, dialogue). Keeps NFR-9. |
| D7 | `unlocked` status | In the type, never produced in production; the next level is `locked` until reached. Unavailable levels (> `total_questions`) are `locked` + `available=false`. |
| D8 | Cube perspective in the reference shrinks with distance | 18-unit cubes everywhere except the K1 S1 perspective band (`cubeScale` curve in 2.3), which starts and ends at 1.0 so it tiles; distant hills elsewhere use 12-unit cubes. |
| D9 | Kingdom ids | A single helper `kingdomIdOf(map) = map.order_index` (the type in `api.ts` declares `order_index: number`; fallback to `map.id` if it is not a finite integer 1..3). Every `map.id` use in the list in 19.2 goes through it. |
| D13 | Mode vs. fallback | See 19.1: mode is a runtime value (`flowMode`), resolved lazily on first read with the same order as the factory (default `'voxel'`) and overwritten by the factory after a construction-time fallback; never read at module load. |
| D10 | Test runner | `vitest` added as a pinned dev dependency (exact version compatible with Vite 8 at install time; verify peer range). No other dependency is added. If it cannot be installed, the implementer reports the blocker instead of switching runners. |
| D11 | K1 S1 contains the Bayan hall and Capitol (A2) | Kept as in the requirements. K2 and K3 have their own, larger versions as hero landmarks. |
| D12 | Image to path mapping (A4) | The implementer re-confirms by path and byte size (3,012,642 vs 2,899,229) before measuring anchors. |

Open assumptions needing review: the exact K1 spine waypoints and K2/K3 waypoint tables above are starting values; the generator test is the arbiter (spacing 90 to 200, no overlap with landmarks, level 1 of k+1 above level 45 of k). Nothing in this design changes the backend.

## 16. Error handling

| Operation | Failure | Class | Behaviour | Caller receives | Logging |
|---|---|---|---|---|---|
| `getContext('2d')` returns null or throws | no canvas support, context lost at start | Fatal for this renderer | Factory catches, falls back to `Game2DMapRenderer` (PNG) and sets a `sessionStorage` flag so it will not retry this session | Working map (fallback) | `console.error('[MAP] voxel init failed, using PNG fallback', err)` once |
| Canvas context lost during use (`contextlost` event) | GPU reset | Recoverable | Pause RAF, drop baked bitmaps, on `contextrestored` rebuild bitmaps and resume | no API effect | `console.warn` |
| Segment bake allocation fails (`OffscreenCanvas`/`canvas` throws or memory) | low-memory device | Recoverable | Evict all but current, retry once at scale 0.75; if it fails again keep the placeholder permanently for that segment and lower quality to `low` | map still usable, softer | `console.warn` once per segment |
| Bake exception in generation code (bug) | thrown error | Fatal for that segment | Segment shows placeholder; error is rethrown nowhere; the rest keep working | none | `console.error` with segment id and seed |
| `setProgress`/`updateProgress` invalid input (kingdom not in 1..3, level not an integer 1..45, NaN) | caller bug | Recoverable | Input is clamped (`kingdom` to 1..3, `level` to 1..45) and a flag `lastProgressInvalid` set; state is updated using the clamped values | none (no throw) | `console.warn` (once per distinct value) |
| `total_questions` missing or invalid | backend field absent | Recoverable | Treated as 45 only if the field is absent; if present and < 1, treated as 1; > 45 treated as 45 | none | `console.warn` |
| `animateWalkingPath` empty or single point | caller bug | Recoverable | `onArrival` is called on the next frame | callback runs | `console.warn` |
| `animateWalkingPath` called while walking | double trigger | Recoverable | Previous walk is cancelled, the avatar snaps to its end position, new walk starts; the old `onArrival` is dropped (token) | only the latest callback fires | `console.debug` |
| `centerOnLocation(x, y)` with NaN or outside world | caller bug | Recoverable | Clamped to the world | none | `console.warn` |
| Avatar image fails to load (`onerror`) | 404 or offline | Recoverable | Draw a vector fallback avatar (circle + initial) | none | `console.warn` once |
| Font not ready (`document.fonts.load` rejects/times out at 1.5 s) | font missing | Recoverable | Sign text uses Quicksand/system sans; sprites re-rasterised when the font arrives | none | none |
| `ResizeObserver` unavailable | very old browser | Recoverable | Fall back to `window.resize` | none | none |
| `matchMedia` unavailable | old browser | Recoverable | Reduced motion defaults to false | none | none |
| `remount` / `destroy` called twice | double call | Recoverable | Idempotent no-ops | none | none |
| Pointer event for a destroyed renderer | race | Recoverable | Listeners removed in `destroy`; handlers guard on `this.destroyed` | none | none |
| Node data invariant broken (tests only) | bad generated data | Fatal at test time | `validateNodes()` throws in unit tests and in the demo on load (with a visible error panel); production does not run the validator beyond a cheap length check (`NODES.length === 135`) which falls back to the PNG renderer if false | n/a | `console.error` |
| Integration: voxel flag on but `createMapRenderer` throws | any | Fatal for voxel | Same PNG fallback as the first row | working map | `console.error` |

Rules: public API methods never throw for bad runtime input; they clamp and warn. The only intentional throws are in `validateNodes()` and the factory's internal try/catch (which converts them to the fallback). No error is shown to the student; developers see console messages. Warnings are de-duplicated by message key to avoid per-frame spam.

## 17. Input validation (external inputs)

| Input | Required | Type / range | On failure |
|---|---|---|---|
| `activeMapId` / `currentKingdom` | required | integer 1..3 | clamp to 1..3, warn |
| `currentQuestionIndex` / `currentLevel` | required | integer 1..45 | clamp, warn. Level 46+ from legacy modulo callers is a bug; `getStepRef` returns `null` for it (AC6) |
| `starsHistory[].mapId`, `orderIndex`/`questionIndex`, `stars` | optional list | ints; stars clamped to 1..3 (0 treated as missing -> 3) | entry skipped if the level is out of range; warn once |
| `customMaps` | optional | array of `{id, title, ...}`; title string max 60 characters | invalid items ignored; titles truncated with an ellipsis in the banner |
| `total_questions` | optional | integer 1..45 | see section 16 |
| `initialPlayerPos` | optional | `{x,y}` finite | ignored if invalid or if progress determines the node |
| Pointer/wheel/keyboard events | n/a | finite numbers only | non-finite deltas dropped |
| `?map=` URL parameter / localStorage `vq_map_renderer` / `VITE_MAP_RENDERER` | optional | `'voxel' | 'png'` (case-insensitive) | any other value ignored (next source used) |
| Demo controls | n/a | clamped by `min/max` attributes and by the API | n/a |

## 18. Invariant ownership

| Invariant | Enforced by | Why there |
|---|---|---|
| 135 nodes, unique `globalIndex`, formula, in-bounds, spacing, level-1-above-45 | `tools/generate-nodes.ts` (generates) + `validateNodes()` in `core/layout.ts` (checks) + unit tests | Data correctness belongs in the pure data layer so every consumer (renderer, flow, demo) can trust it |
| Exactly one `current` node | `deriveStatuses` (pure function) | Single place; tested over 135 combinations |
| `globalIndex = (k-1)*45 + q`; level range | `flowAdapter.globalLevelNumber/getStepRef` | One shared helper; `mapFlowController` delegates, no copies of constants |
| Camera never leaves the world; zoom range | `core/camera.ts` `clampToWorld` applied at the end of every camera update | Single choke point for all inputs and animations |
| Baked bitmaps <= `maxBaked` and bytes <= `BAKE_BUDGET`; visible segments never evicted | `render/bakeBudget.ts` (pure) + `render/bakeQueue.ts` | Owner of allocation; pure maths is unit tested |
| Renderer mode (voxel vs png) is one value per page load, correct even before the map mounts | `flow/flowMode.ts`: lazy `resolveRequestedMode()` on first read, overwritten by `createMapRenderer` after a construction-time fallback | The flow layer must agree with the renderer that actually exists |
| No runtime request for the PNGs | Voxel code never references `/assets/vocab-map.png` or `reference/`; a unit test greps `MAP/src` and `MAP/data` for those strings; the Playwright check (AC9) confirms | Static guard + runtime check |
| Events fire once per interaction | `input/pointer.ts` state machine (down/move/up with threshold) and the event dispatcher | Interaction layer owns the click-vs-drag decision |
| Backend playable levels vs map nodes | `setAvailability` + `deriveStatuses` (`available`) | Presentation never assumes 45 questions exist |
| Input lock during sequences | `VoxelWorldMap.inputLocked` set/cleared by the sequence runner only (try/finally so an exception cannot leave it locked) and `destroy()` | One owner prevents stuck locks |

## 19. Integration into the existing game (minimal wiring outside MAP)

The mount uses a factory with a runtime switch, not a code replacement, and keeps the PNG renderer as fallback.

### 19.1 Switch

`MAP/src/index.ts` exports `isVoxelMapEnabled()` and `createMapRenderer(...)` (same arguments as the old constructor). Resolution order: **(0) if `sessionStorage.vq_map_voxel_failed` is set (written by the factory after a construction-time failure, section 16), mode is `png`** and nothing else is consulted; then URL `?map=voxel|png` (also persisted to `localStorage.vq_map_renderer`), then `localStorage.vq_map_renderer`, then `import.meta.env.VITE_MAP_RENDERER`, then the default **`'voxel'`**. `createMapRenderer(...)` returns `{ renderer: MapRenderer; mode: 'voxel' | 'png' }` (finding 9). It tries `VoxelWorldMap` when enabled; if construction throws, `getContext` fails, or the flag is `png`, it constructs `Game2DMapRenderer(...)` (imported from `src/game2d`). **Before returning**, it calls `setFlowMode(mode)` in `MAP/src/flow/flowMode.ts`, a tiny module (`getFlowMode()`, `setFlowMode()`) that `mapFlowController` reads **at call time**, never at module load. **Eager resolution (pass 4, finding 4)**: `flowMode.ts` has no `'png'` default. It holds `let mode: 'voxel' | 'png' | undefined`, and the first `getFlowMode()` call, when no factory call has happened yet in this page load (refresh straight into the question screen, or the map screen never mounted), evaluates `resolveRequestedMode()` and caches the result. `resolveRequestedMode()` is the exact resolution order above (step 0 `sessionStorage.vq_map_voxel_failed`, then URL, `localStorage`, `VITE_MAP_RENDERER`, default `'voxel'`) and lives in `flowMode.ts` (it reads only `window`/`sessionStorage`/`localStorage`/`import.meta.env`, no `src/` import, so the import boundary holds); `index.ts` imports it rather than duplicating it. `setFlowMode(mode)` called by the factory overwrites the cached value, which is how a construction-time fallback to `'png'` is propagated. Level numbers ("LEVEL n COMPLETE!") and walk paths after a refresh into the question screen are therefore voxel-correct without the map ever mounting (AC23). Consequently `getStepRef`, `globalLevelNumber`, `computeWalkPath`, `buildKingdomTransitionAction` always agree with the renderer that actually exists, including after a runtime fallback. A later context-loss fallback after the first frame does not switch renderers (the voxel renderer recovers in place, section 16); only the construction-time decision sets the mode. `main.ts` `startOver`/`remount` paths reuse the same mode. `WorldMapScreen` receives `{renderer}` and stores `mode` for the flow. `public/assets/vocab-map.png` is untouched and still loaded by the fallback only. The factory lives in `MAP/src/index.ts`, which is the only MAP file importing from `frontend-game/src`: `../../src/game2d` (PNG fallback) and `../../src/soundManager` (it builds the `hooks` argument passed to `VoxelWorldMap`; section 4). Dependency direction MAP -> src is limited to those two imports and enforced by `importBoundary.test.ts`.

### 19.2 Files modified outside `MAP` (complete list)

0. **Single helper** (finding 9/10): `kingdomIdOf(map)` and `kingdomByMapId` live in `MAP/src/flow/kingdomMap.ts`. The complete list of `map.id` sites to convert (from a grep of `frontend-game/src`; the implementer re-greps `map?.id`, `map.id`, `.map.id` before editing and also converts anything new):
   - `src/main.ts`: 644 (`isMapChanged` compares `map.id`; keep comparing raw `map.id`, because it detects a DB change), 666 (`activeMapId` for `hydrateEnteredKingdomIds` and state: `kingdomIdOf`), 921 (`activeMapId || 1` for theming), 1094 (`newMapId`: `kingdomIdOf`), 1489 (`syncMapRendererOptions`), 1569, 1655, 1704, 1779, 1829; plus 991 and 1709 which filter `h.mapId === activeMapId`, which must use `kingdomByMapId.get(h.mapId)`.
   - `src/utils/teacherAnimation.ts` line 72 and `src/components/screens/QuestionScreen.ts` line 70 (theme selection `activeMapId === 3 / 2`): use `kingdomIdOf`.
   The list above is added to the outside-MAP change list as item 2 below.
   `kingdomByMapId: Map<number, KingdomId>` is built in `main.ts` by `rememberMap(map)` called on every `/api/game/question` response (and for each `customMaps` entry): `kingdomByMapId.set(map.id, kingdomIdOf(map))`. When converting `completed_questions[].map_id` (history.ts lines 47 to 62), the kingdom is `kingdomByMapId.get(map_id)`; if unknown, fall back to `map_id` when it is an integer 1..3, otherwise the entry is skipped with a de-duplicated `console.warn`. Test (`kingdomMap.test.ts`): DB ids `{11,12,13}` with `order_index {1,2,3}` map to kingdoms 1..3; an unknown `map_id` 99 is skipped; unknown `map_id` 2 falls back to kingdom 2. Residual limitation (documented in README, backend follow-up): a completed map that has never been the active map in this browser session stays unknown until the backend sends `order_index` with `completed_questions`.
1. `src/components/screens/WorldMapScreen.ts`: replace `import { Game2DMapRenderer, type StarHistoryItem } from '../../game2d'` with `import { createMapRenderer, type MapRenderer, type StarHistoryItem } from '../../../MAP/src'`; replace the types `Game2DMapRenderer` with `MapRenderer` in `WorldMapScreenProps` (lines 14, 17, 18) and `new Game2DMapRenderer(` (line 133) with `createMapRenderer(...).renderer` (the returned `mode` is already stored by the factory in `flowMode`). Pill text: `PROSPERIDAD MAP` stays. Pass `total_questions` via the next item.
2. `src/main.ts`: replace the import and field type at lines 3 and 64 (`MapRenderer`); convert every `map.id` site listed in item 0 to `kingdomIdOf(map)` (FR-31) and call `rememberMap(map)` on each question response so `completed_questions` are keyed by kingdom via `kingdomByMapId` (item 0); after each `/api/game/question` response call `mapRenderer.setAvailability({[kingdom]: map.total_questions})` if present (optional method guarded by `'setAvailability' in renderer` so the PNG fallback still works); use `globalLevelNumber` from the adapter in the star-burst overlay (already routed through `mapFlowController`).
3. `src/mapFlowController.ts`: remove `STEP_COORDS`, `MAP_OFFSETS`, `KINGDOM_TRANSITION_PATHS` and the modulo in `getStepRef`; `getStepRef(mapId, q)` delegates to `flowAdapter.getStepRef(mapId, q)` when `getFlowMode() === 'voxel'` (returns `null` for `q > 45`), else uses a retained legacy table limited to `q <= 5` (no modulo); `globalLevelNumber(k, q)` becomes `(k-1)*45 + q` in voxel mode and the old offsets in PNG mode (mode read from `getFlowMode()` **at each call**, never cached at module load; the factory sets it); `computeWalkPath` delegates; `buildKingdomTransitionAction` fallback `|| 5` becomes `LEVELS_PER_KINGDOM` of the mode. `StepRef` gets `blockH` as today, so `main.ts` call sites are unchanged.
4. `src/dialogueData.ts`: replace "level 1 to 5 / 6-10 / 11-15" with per-kingdom wording **"levels 1 to 45"** in all three kingdoms (decision for FR-32; per-kingdom numbers match the HUD "Kingdom 1: 37/45" while the star burst keeps global numbers). Audio files are not changed (listed for content team).
5. `tsconfig.json`: `include` -> `["src", "MAP/src", "MAP/data", "MAP/demo/main.ts"]`.
6. `package.json`: scripts `map:demo` (`vite --config MAP/demo/vite.config.mjs`), `map:test` (`tsc -p MAP/tsconfig.tools.json --noEmit && vitest run --config MAP/vitest.config.mjs`), `map:nodes` (`MAP_REGEN=1 vitest run --config MAP/vitest.config.mjs MAP/tests/generate-nodes.regen.test.ts`, which rewrites `data/nodes.ts`; the normal test only compares, so no extra TS runner dependency is needed); pinned devDependencies `vitest` (D10) and `@types/node`.
   Also in this list by reference: the `map.id` conversions of item 0 in `main.ts`, `utils/teacherAnimation.ts`, `components/screens/QuestionScreen.ts`, and `utils/history.ts` (only if `kingdomByMapId` is applied there rather than in `main.ts`; decision: applied in `main.ts` when it builds the star history, so `history.ts` is **not** modified).
7. Optionally `README.md` mention (docs only).

Not modified: `game2d.ts`, `public/assets/*`, all `backend/*`, `frontend-portal/*`, `src/types/state.ts` (no state shape change: progress stays derived from the existing fields).

### 19.3 Data flow

Backend `GET /api/game/question` -> `main.ts` (`map.order_index ?? map.id`, `current_question_num`, `completed_questions`, `total_questions`) -> `WorldMapScreen` -> `mapRenderer.updateProgress(kingdom, level, starsHistory)` + `setAvailability`. Answer correct -> existing star-burst -> `animateWalkingPath(getStepRef-based polyline)` -> `onArrival` -> existing next-screen logic. Kingdom boundary -> `buildKingdomTransitionAction` returns the gate path (section 5.4) -> same call. `mapFlowController` flags (`enteredKingdomIds`, `mapPhase`) are passed via `setMapFlowOptions` unchanged.

### 19.4 Legacy parity while backend still serves 5 levels

With `total_questions = 5`: nodes 6 to 45 are unavailable ("coming soon"); finishing level 5 triggers `buildKingdomTransitionAction` as soon as the server advances the map, which calls the gate sequence from **level 5** (the last available level) instead of 45. This is the shipping scenario (AC7), not an edge case, so it is defined precisely by `walkPlan` (5.4): the arc from L5 to the gate front is about 5,000 units, which exceeds the 900-unit limit, so the avatar walks two node hops, warps (120 + 220 ms fade) to the gate front, walks the last 200 units, and the normal gate, banner and camera-travel sequence follows. The avatar never moves faster than 400 units/s and step sounds never exceed 6 per second. The avatar then arrives at the next kingdom entrance; L1 of the next kingdom is current and the skipped greyed nodes K1 L6-45 are `locked` and "coming soon", never `completed` (3.5). Partial-kingdom skip is thus supported with no special case.

## 20. Testing strategy

Unit tests (vitest, no DOM, `MAP/tests/`):
- `nodes.test.ts`: AC1, AC2 (with the D2 exemption), AC3 (K1 anchors), seeded determinism (two generations are `deepEqual`), bounds, level-1-above-45, minimum spacing 90, node clearance from landmark footprints (landmark rect list from scene scripts).
- `status.test.ts`: AC4 (amended) over 135 combinations, stars default, availability including the `{1:5,2:5,3:5}` / current K2 L1 row and an unavailable-current case.
- `walkplan.test.ts`: from L45 the plan is a single animated path of <= 900 units; from L5 with the 5-question backend it has `warpAfterIndex`, animated distance <= 900, no animated segment > 400 units.
- `gates.test.ts` (3.2 rules), `farfield.test.ts` (2.3), `importBoundary.test.ts` (4), and in `nodes.test.ts` the K1 corridor checks (pins A and B, 90 units from L8/L9, 60 from footprints, boardwalk polyline clearance, 3.4).
- `bakeBudget.test.ts` (including the 390x844 phone case: `visibleMax` 4, `maxBaked` 6, scale 1.5), `kingdomMap.test.ts`, `flowMode.test.ts` (mode set by the factory is what `getStepRef` sees, including after a forced fallback; **with no factory call and `VITE_MAP_RENDERER` unset, `getFlowMode()` is `'voxel'`**; with `sessionStorage.vq_map_voxel_failed` set and no factory call it is `'png'`; modules are reset between cases with `vi.resetModules()`), `types.test-d.ts` (compile-time `satisfies`).
- `walkpath.test.ts`: AC5 (135 x 135 under 100 ms, start/end, max segment length, gate for cross-kingdom).
- `flow.test.ts`: AC6 (`globalLevelNumber`, no modulo, level 46 -> null), 5-level backend scenario (AC7 logic part).
- `camera.test.ts`: follow target offset (avatar y 5000, vh 800, zoom 1 -> cy 4904), clamp, `minZoom`, `zoomAround` keeps the anchor fixed, `glideDuration`, per-frame step bound simulated at 60 fps (AC16/17 math).
- `rng.test.ts`, `raster.test.ts` (voxel rasteriser against a tiny model with a Node canvas stub for exposed-face counting; pixel-level tests are not done), `noRefAssets.test.ts` (greps sources for the two PNG names).

Integration/visual (manual + Playwright script in `tools/`, not in `npm run build`): AC8 to AC22 using the demo (screenshots at the listed states, 2x DPR, reduced motion frame diff, 4x CPU throttle FPS, network log for AC9, LRU/memory readout for AC21). Real-game checks AC23 use the existing dev server and backend with PIN 123456. `npm run build` is run at the end of every implementation milestone (AC24).

Hard to unit test (by nature): the visual fidelity and the feel of the camera. They are covered by the demo's checklist, side-by-side screenshots at 1774x887 and a reported histogram/SSIM figure.

## 21. Risks

- Procedural art may not reach the reference's detail on the first pass. Mitigation: the voxel model system and the checklist-driven iteration are the first milestone (K1 S1 only) before any other segment is built; if S1 fails the visual gate, the later work stops.
- Bake CPU time on very low-end devices. Mitigation: placeholder + row-sliced bakes + `low` scale 1.
- AC20 (at least 55 fps at 4x CPU throttle on `medium`, at least 30 fps on `low`) is aggressive; the milestone-0 gate (9.2) uses the same numbers, the governor and `low` tier exist, and the spike fails the design early rather than late.
- Dependence on the unfixed backend (5 questions per map) is isolated by `setAvailability`.

## 22. Responses to review

### Pass 4 (third review: 0 HIGH, 5 MEDIUM, 3 NIT). All 8 addressed; none ignored or backlogged. No open questions remain.

| # | Sev | Response |
|---|---|---|
| 1 | MED | Addressed. `MapSoundHooks` = hover, click, wrong, step, padlockUnlock, whoosh, success, gateOpen with a mapping table to the real `soundManager` functions and firing points; `gateOpen` maps to `playPadlockUnlock` (no new audio asset). `playUnlock` and `playLocked` removed everywhere (4, 5.4, 8, 10). |
| 2 | MED | Addressed. Gate is now unthrottled <= 4.5 ms, 4x throttle >= 55 fps `medium` and >= 30 fps `low`, measured at 1366x768 on K1 L20, identical to AC20; section 21 text corrected. AC20 is not amended (9.2, 21). |
| 3 | MED | Addressed. Rule table in 5.4: `unlocked(k)`, `entered(k)`, entrance hit, node hit, mist/padlock, `awaiting_kingdom_click` camera, walks; `isKingdomProgressUnlocked` removed; section 10 points to it. |
| 4 | MED | Addressed. `flowMode.ts` resolves lazily on first `getFlowMode()` with the factory's resolution order (default `'voxel'`), factory overwrites on fallback; `flowMode.test.ts` cases added (19.1, 18, 20, D13). |
| 5 | MED | Addressed with option (a). L9 nudged (1270,368) -> (1266,364): L9-L10 93.0, shift 5.7 inside AC3's 12. Pins moved to A (1245,496), B (1196,304) so B-L9 92.2 and A-B 198.2 (<= 200) hold; all clearances, the junction point (1227,424) and D2 updated. Option (b) rejected because it would weaken AC2 with a new exemption. Residual risk: L10-L11 is 90.8 and A-B has 1.8 margin; the test is the arbiter with the stated nudge rules (3.3, 3.4). |
| 6 | NIT | Accepted limit, documented (simplest: no second tunable). README limitation text specified (14.0 step 5, 13). |
| 7 | NIT | Fixed. Demo uses relative imports, no alias, so root `tsc` resolves it (14). |
| 8 | NIT | Fixed. README limitations must say K1 S1 is not the full reference frame (13, D4). |

### Pass 3 (second review: 6 MEDIUM, 5 NIT). All 11 addressed; none ignored or backlogged.

| # | Sev | Response |
|---|---|---|
| 1 | MED | Addressed with option (b). Checklist items 1 and 2 are scored on the K1 S7 sky/gate zone and K1/K2 boundary (which has the full sky and at least 6 large clouds); K1 S1 compare keeps 2 clouds. AC8 reworded as D3 item (e); D4 notes the consequence (14.1, D3, D4). |
| 2 | MED | Addressed. Metric is now 48x48 px blocks (37x19 grid), 2x the 24-unit box tolerance; gate 75 percent of blocks under deltaE76 14 and mean under 12, secondary to boxes and checklist. K1 S1 scatter is disabled and decor is hand-placed in `scenes/k1.ts` (14.0 step 3). |
| 3 | MED | Addressed. Routes re-derived: pinned nodes L17 at A (1245,500) and L18 at B (1200,310) with recomputed clearances (A-L8 99, A-L9 134, B-L9 91, B-tower 68, A-B 195); the old route was wrong. Junction rule: plank pad over the stone path at about (1222,437). Polyline and node clearance tests added; `pins` added to the generator (3.3, 3.4, 20). `noNodeRanges` is not needed. |
| 4 | MED | Addressed. Row-by-row far-field layer with per-row width `18*s(y)`, noise sampled at world-space cube centres, objects drawn afterwards on the 18-unit grid with a 1-cell skirt, `farfield.test.ts` (2.3). |
| 5 | MED | Addressed. `target.cy = avatar.y - 0.12*vh/zoom` (camera above avatar); test value 4904 (5.2). |
| 6 | MED | Addressed. `GateRecord` and `EntranceRecord` types with concrete values for K1, K2 gates and K1, K2, K3 entrances (K1 sign rect 20,18260,390x210), generated in `data/gates.ts`, `gates.test.ts` (3.2). |
| 7 | NIT | Fixed: phone `visibleMax` 4, `maxBaked` 6, 1.5 = 85 MB, 2 = 151 MB (9.1). |
| 8 | NIT | Fixed: `LEVEL1_U` is K2 and K3 only; K1 L1 at u = 112 (3.3). |
| 9 | NIT | Fixed: ease-in-out cubic peak 3x; 6.25 vh/s = 0.104 vh/frame (5.2). |
| 10 | NIT | Fixed: `sessionStorage.vq_map_voxel_failed` added as step 0 of the resolution order (19.1). |
| 11 | NIT | Fixed: only `MAP/src/index.ts` imports from `src/` (`game2d`, `soundManager`); the component takes a `hooks` argument; demo imports the component directly; `importBoundary.test.ts` (4, 19.1). |

### Pass 2 (first review: 13 findings)

All 13 findings are addressed; none is ignored or backlogged. No choice conflicts with REQUIREMENTS.md except the wording amendments listed in D3, which the next step must apply to REQUIREMENTS.md.

| # | Sev | Response |
|---|---|---|
| 1 | HIGH | Addressed. `MapRenderer` now uses registration methods, `Promise<void>` returns, optional history; resolve timings stated; `satisfies` compile-time test added; `game2d.ts` unedited (section 4). |
| 2 | HIGH | Addressed. One rule for availability and status, stars rule, edge case for an unavailable current level, test row, AC4 amended (3.5, D3). |
| 3 | HIGH | Addressed. `walkPlan` with 900-unit limit and warp, speed cap 400 units/s, step sound cap 6/s, defined from the last available level (4, 5.4, 19.4). |
| 4 | MED | Addressed with option (a): 7 segments, world 18,627, spines lengthened, all dependent numbers updated (2.3, 3, 6.4, 9.1). D1 hedge removed. |
| 5 | MED | Addressed. Fidelity protocol with numeric gates (14.0), perspective band in K1 S1 that tiles (2.3), boxes JSON, blocks metric, scored checklist. The sky-band deviation (D4) stays, justified by seamless tiling, and is excluded from the metric. |
| 6 | MED | Addressed. Footprint table, explicit boardwalk exit route with measured clearances, adjustment rule, and a test that imports the footprints (3.3, 3.4). Caveat: coordinates are measured by eye from the viewed reference and are re-measured by the implementer. |
| 7 | MED | Addressed. `maxBaked = visibleMax + 2` bounded by a 120 MB budget, bake scale derived from it, visible never evicted, pure tested function (9.1). |
| 8 | MED | Addressed. Amended wordings for FR-9, FR-12, AC17, AC4 listed in D3; nearest-node rule in section 10. |
| 9 | MED | Addressed. `createMapRenderer` returns the mode, `flowMode.ts` read at call time, full `map.id` site list with line numbers, `kingdomIdOf` helper (19.1, 19.2 item 0). |
| 10 | MED | Addressed. `kingdomByMapId` built per session, fallback and skip rules, test with ids {11,12,13}; residual limitation documented as a backend follow-up. |
| 11 | NIT | Addressed. Verified there is no `node_modules/@types`; explicit include files, `.mjs` configs, tools tsconfig with pinned `@types/node` (13). |
| 12 | NIT | Addressed. Mandatory perf spike milestone 0 with a gate; figures labelled estimates (9.2). |
| 13 | NIT | Addressed. K3 waypoints listed explicitly (3.3). |
