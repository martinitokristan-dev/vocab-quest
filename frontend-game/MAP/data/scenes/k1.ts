import { K1_S1_REF_Y0 } from '../spines';
import type { DecorMix, SceneItem, SegmentSpec } from './types';

export interface Footprint {
  readonly name: string;
  /** Reference px rect: x0, y0, x1, y1. */
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  /** Bridge footprints are exempt from the node clearance rule. */
  readonly bridge?: boolean;
}

/** Landmark footprints of K1 S1 (DESIGN 3.4); re-measured on the reference (+/-6 px) and committed here. */
export const K1_S1_FOOTPRINTS: readonly Footprint[] = [
  { name: 'school', x0: 80, y0: 320, x1: 460, y1: 520 },
  { name: 'sign', x0: 30, y0: 530, x1: 400, y1: 720 },
  { name: 'towerWest', x0: 425, y0: 370, x1: 525, y1: 515 },
  { name: 'bridge', x0: 548, y0: 585, x1: 668, y1: 668, bridge: true },
];

/** Footprint in world units. */
export function footprintWorld(f: Footprint): { x0: number; y0: number; x1: number; y1: number } {
  return { x0: f.x0, x1: f.x1, y0: K1_S1_REF_Y0 + f.y0, y1: K1_S1_REF_Y0 + f.y1 };
}

/** A landmark: model key, top-left of its opaque pixels in reference px, optional draw scale. */
export interface K1Landmark {
  readonly id: string;
  readonly m: string;
  readonly at: readonly [number, number];
  readonly f?: number;
  /** Depth-sort override (reference px y); defaults to the sprite's bottom edge. */
  readonly sortY?: number;
}

export const K1_LANDMARKS: readonly K1Landmark[] = [
  { id: 'school', m: 'school', at: [80, 318] },
  { id: 'sign_planter', m: 'sign_planter', at: [32, 618] },
  { id: 'letter_i', m: 'letter_i', at: [42, 590], sortY: 726 },
  { id: 'letter_heart', m: 'letter_heart', at: [86, 557], f: 1.25, sortY: 726 },
  { id: 'letter_e1', m: 'letter_e1', at: [172, 570], sortY: 726 },
  { id: 'letter_p', m: 'letter_p', at: [218, 559], sortY: 726 },
  { id: 'letter_c', m: 'letter_c', at: [262, 548], sortY: 726 },
  { id: 'letter_e2', m: 'letter_e2', at: [305, 541], sortY: 726 },
  { id: 'letter_s', m: 'letter_s', at: [348, 532], sortY: 726 },
  { id: 'towerWest', m: 'tower', at: [428, 372] },
  { id: 'bridge', m: 'bridge', at: [550, 586], sortY: 760 },
  { id: 'wf1', m: 'waterfall', at: [740, 612] },
  { id: 'wf2', m: 'waterfall', at: [1106, 612] },
  { id: 'wf3', m: 'waterfall', at: [1309, 712] },
  { id: 'wf4', m: 'waterfall', at: [1572, 610] },
];

/** Flags (reference px of the top-left corner of the flag cloth). */
export const K1_FLAGS: ReadonlyArray<{ kind: 'ph' | 'yellow'; x: number; y: number; w: number; h: number }> = [];

/** Hand-placed decor: model key, bottom-centre (reference px), optional scale. */
export type K1Item = readonly [m: string, x: number, y: number, f?: number];

export const K1_ITEMS: readonly K1Item[] = [
  // distant pyramid hills (smaller = farther)
  ['hill_a', 110, 215], ['hill_b', 295, 215], ['hill_a', 548, 208], ['hill_b', 640, 192, 0.8], ['hill_a', 840, 200],
  ['hill_b', 215, 188, 0.6], ['hill_a', 30, 182, 0.6], ['hill_b', 482, 186, 0.55], ['hill_a', 775, 178, 0.5],
  ['hill_b', 925, 182, 0.55], ['hill_a', 1004, 192, 0.6], ['hill_b', 1290, 168, 0.85], ['hill_a', 1375, 170, 0.85],
  ['hill_b', 1700, 188, 1], ['hill_a', 1765, 178, 0.75], ['hill_b', 1620, 150, 0.55], ['hill_a', 1100, 178, 0.5],
  ['hill_b', 700, 170, 0.5], ['hill_a', 380, 178, 0.45], ['hill_b', 1180, 176, 0.5], ['hill_a', 1480, 160, 0.45],
  // far-field and upper trees
  ['oak_l', 58, 312], ['oak_l', 158, 300], ['oak_m', 205, 247], ['oak_l', 438, 248], ['oak_xl', 545, 362],
  ['oak_l', 640, 290], ['oak_l', 730, 232], ['oak_s', 352, 300], ['oak_m', 590, 330], ['oak_s', 330, 232],
  ['oak_s', 35, 206], ['oak_m', 630, 395], ['oak_s', 475, 352], ['oak_m', 120, 380], ['oak_s', 770, 275],
  ['oak_l', 1160, 196], ['oak_l', 1272, 236], ['oak_m', 998, 268], ['oak_s', 919, 240], ['oak_s', 1224, 218],
  ['oak_m', 1090, 330], ['oak_s', 1000, 340], ['oak_s', 1195, 262], ['oak_l', 1520, 90, 0.5], ['oak_s', 1700, 280],
  ['oak_m', 1740, 300], ['oak_s', 1175, 140, 0.6], ['oak_s', 700, 205, 0.6], ['oak_s', 880, 235, 0.6],
  ['oak_s', 260, 205, 0.7], ['oak_s', 395, 205, 0.7], ['oak_s', 570, 230, 0.8], ['oak_s', 820, 260, 0.8],
  ['oak_s', 20, 320, 0.8], ['oak_m', 15, 400], ['oak_s', 585, 470], ['oak_m', 575, 520],
  // lower field trees
  ['oak_l', 825, 658], ['oak_xl', 905, 805], ['oak_l', 1110, 792], ['oak_xl', 1380, 640], ['oak_l', 1470, 860],
  ['oak_l', 1620, 756], ['oak_m', 1700, 690], ['oak_m', 575, 676], ['oak_m', 690, 720], ['oak_s', 610, 760],
  ['oak_m', 195, 868], ['oak_s', 20, 830], ['oak_l', 40, 860], ['oak_m', 840, 760], ['oak_m', 980, 720],
  ['oak_s', 760, 840], ['oak_m', 1230, 775], ['oak_s', 1290, 880], ['oak_m', 1520, 700], ['oak_s', 1570, 800],
  ['oak_s', 1740, 860], ['oak_m', 1770, 780], ['oak_s', 1330, 580], ['oak_s', 1500, 560], ['oak_s', 1210, 640],
  ['oak_s', 1060, 640], ['oak_m', 960, 650], ['oak_s', 700, 640], ['oak_s', 470, 640], ['oak_s', 380, 790],
  ['oak_m', 300, 780], ['oak_s', 110, 790], ['oak_m', 520, 840], ['oak_s', 650, 880], ['oak_m', 770, 590],
  // flowering and plain bushes
  ['bush_o', 255, 520], ['bush_y', 350, 523], ['bush_p', 330, 526], ['bush_o', 395, 516], ['bush_w', 100, 520],
  ['bush_y', 20, 520], ['bush_o', 400, 640], ['bush_p', 78, 735], ['bush_y', 560, 600],
  ['bush_o', 770, 500], ['bush_y', 800, 505], ['bush_o', 835, 495], ['bush_p', 970, 508], ['bush_o', 1010, 520],
  ['bush_y', 1070, 500], ['bush_o', 1100, 500], ['bush_p', 1140, 470], ['bush_o', 870, 515],
  ['bush_o', 1370, 332], ['bush_y', 1405, 325], ['bush_p', 1560, 348], ['bush_y', 1600, 335], ['bush_o', 1645, 360],
  ['bush_y', 1555, 420], ['bush_o', 1612, 405], ['bush_p', 1520, 440], ['bush_w', 1750, 340], ['bush_y', 1620, 460],
  ['bush_o', 1420, 360], ['bush_p', 1350, 322], ['bush_y', 1725, 450], ['bush_o', 1690, 510],
  ['bush', 480, 700], ['bush_p', 640, 580], ['bush_y', 708, 585], ['bush_o', 740, 575],
  ['bush_y', 820, 740], ['bush_o', 870, 700], ['bush_p', 880, 770], ['bush_y', 960, 840], ['bush_o', 1000, 780],
  ['bush_p', 1150, 700], ['bush_y', 1200, 760], ['bush_o', 1250, 840], ['bush_p', 1470, 740], ['bush_y', 1590, 700],
  ['bush_o', 1640, 840], ['bush_w', 1700, 800], ['bush_p', 1760, 700], ['bush_y', 420, 760], ['bush_o', 280, 830],
  ['bush_p', 160, 840], ['bush_y', 90, 800], ['bush_o', 600, 870], ['bush_y', 1420, 740], ['bush_p', 1290, 640],
  ['bush', 190, 240], ['bush', 305, 275], ['bush', 400, 270], ['bush', 520, 300], ['bush', 700, 330],
  ['bush', 860, 320], ['bush', 1050, 300], ['bush', 1250, 280], ['bush', 150, 330], ['bush', 60, 370],
  // stone, rocks and lily pads
  ['rock_m', 270, 840], ['rock_s', 330, 870], ['rock_m', 560, 740], ['rock_s', 610, 810], ['rock_m', 900, 700],
  ['rock_s', 1050, 700], ['rock_m', 1300, 700], ['rock_s', 1180, 830], ['rock_m', 1480, 770], ['rock_s', 1640, 780],
  ['rock_m', 1560, 620], ['rock_s', 1700, 840], ['rock_m', 1250, 520], ['rock_s', 1340, 500],
  ['lily', 665, 735], ['lily', 520, 855], ['lily', 1020, 700], ['lily', 1280, 780], ['lily', 1535, 740], ['lily', 1360, 870],
  // smaller waterfalls
  ['waterfall', 522, 248, 0.75], ['waterfall', 1150, 300, 0.85], ['waterfall', 1405, 570, 0.9], ['waterfall', 1296, 495, 0.6],
  ['waterfall', 565, 592, 0.8], ['waterfall', 302, 262, 0.5], ['waterfall', 392, 304, 0.5], ['waterfall', 1342, 886, 0.9],
  ['waterfall', 880, 330, 0.5], ['waterfall', 1448, 612, 0.6],
];

/**
 * Hand-authored groves: [x0, y0, x1, y1, count, seed] regions (reference px) that the scene script fills
 * deterministically with trees and bushes, skipping water, the route, nodes and landmark footprints.
 */
export const K1_GROVES: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
  [0, 190, 720, 430, 70, 1],
  [720, 190, 1330, 320, 34, 2],
  [1100, 120, 1340, 340, 24, 3],
  [1690, 150, 1774, 330, 8, 4],
  [0, 730, 520, 887, 46, 5],
  [520, 600, 1230, 887, 95, 6],
  [1230, 540, 1774, 887, 95, 7],
  [440, 400, 730, 570, 16, 8],
  [0, 330, 90, 570, 10, 9],
  [1080, 330, 1260, 520, 8, 10],
  [1330, 470, 1620, 570, 14, 11],
  [0, 560, 30, 740, 6, 12],
  [1600, 440, 1774, 520, 8, 13],
];

/**
 * Receding band of stepped pyramid hills behind the grove: [y (bottom, reference px), scale, count, seed].
 * Farther rows are smaller and higher up, as in the reference; the scene script jitters x deterministically.
 */
export const K1_HILL_ROWS: ReadonlyArray<readonly [number, number, number, number]> = [
  [168, 0.42, 22, 1],
  [186, 0.52, 18, 2],
  [208, 0.64, 15, 3],
  [236, 0.8, 12, 4],
  [270, 0.98, 10, 5],
  [310, 1.15, 8, 6],
];

/** Fence polylines (reference px); each is filled with fence tiles every 18 units. */
export const K1_FENCES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[8, 672], [25, 715], [45, 750], [215, 714], [392, 670], [452, 632], [442, 600]],
  [[472, 548], [505, 522], [560, 484]],
  [[603, 456], [612, 500], [626, 548]],
];

/** Hand-authored cobble plazas (reference px rects) added to the measured terrain table. */
export const K1_PLAZAS: ReadonlyArray<readonly [number, number, number, number]> = [
  [250, 495, 330, 530],
];

/** Repeats a model along u at a fixed offset from the route (or an absolute x when abs is set). */
export function along(m: string, u0: number, u1: number, step: number, off: number, f?: number, abs = false): SceneItem[] {
  const out: SceneItem[] = [];
  for (let u = u0; u <= u1; u += step) out.push(abs ? { m, u, x: off, f } : { m, u, off, f });
  return out;
}

/** Default K1 decor mix for the procedural segments. */
export const K1_DECOR: DecorMix = [
  ['oak_s', 0.2], ['oak_m', 0.2], ['oak_l', 0.1], ['oak_xl', 0.03], ['bush', 0.1], ['bush_y', 0.06],
  ['bush_o', 0.06], ['bush_p', 0.05], ['bush_w', 0.04], ['rock_s', 0.06], ['rock_m', 0.04],
];

const ORCHARD: DecorMix = [['apple', 0.55], ['oak_s', 0.12], ['bush_y', 0.1], ['bush_o', 0.1], ['bush_p', 0.08], ['rock_s', 0.05]];
const WOODS: DecorMix = [['oak_m', 0.28], ['oak_l', 0.22], ['oak_xl', 0.12], ['oak_s', 0.14], ['bush', 0.1], ['rock_m', 0.08], ['rock_s', 0.06]];

/** Orchard rows: apple trees on a staggered grid inside [x0, x1] x [u0, u1]. */
function orchard(x0: number, x1: number, u0: number, u1: number): SceneItem[] {
  const out: SceneItem[] = [];
  let r = 0;
  for (let u = u0; u <= u1; u += 120, r++) {
    for (let x = x0 + (r % 2) * 40; x <= x1; x += 80) out.push({ m: 'apple', u, x });
  }
  return out;
}

/** K1 S2-S7 (S1 is the hand-placed reference scene). */
export const K1_SEGMENTS: readonly SegmentSpec[] = [
  {
    // S2: garden terraces, river and bridge
    n: 2,
    ponds: [[330, 1350, 115, 70]],
    items: [
      { m: 'bridge', x: 330, u: 1335, f: 2 },
      { m: 'flower_bed', u: 1000, off: -240 }, { m: 'flower_bed', u: 1040, off: 250 }, { m: 'flower_bed', u: 1200, off: -280 },
      { m: 'flower_bed', u: 1260, off: 270 }, { m: 'flower_bed', u: 1500, off: -240 }, { m: 'flower_bed', u: 1580, off: 260 },
      { m: 'flower_bed', u: 1680, off: -330 }, { m: 'flower_bed', u: 1100, off: 400 }, { m: 'flower_bed', u: 1400, off: 420 },
      ...along('lamp', 1060, 1700, 210, -112), ...along('lamp', 1130, 1700, 210, 112),
      ...along('terrace_wall', 1000, 1000, 1, 1450, 1.0, true), ...along('terrace_wall', 1000, 1000, 1, 1576, 1.0, true),
      ...along('terrace_wall', 1180, 1180, 1, 1500, 1.0, true), ...along('terrace_wall', 1180, 1180, 1, 1626, 1.0, true),
      ...along('terrace_wall', 1380, 1380, 1, 1450, 1.0, true), ...along('terrace_wall', 1380, 1380, 1, 1576, 1.0, true),
      ...along('terrace_wall', 1560, 1560, 1, 1500, 1.0, true), ...along('terrace_wall', 1560, 1560, 1, 1626, 1.0, true),
    ],
    fences: [[[-190, 960], [-190, 1260]], [[210, 1380], [210, 1700]]],
    density: 0.42,
  },
  {
    // S3: playground meadow and a waterfall cascade
    n: 3,
    ponds: [[1480, 1960, 105, 55], [1520, 2220, 115, 60], [1480, 2480, 105, 55]],
    items: [
      { m: 'tower', u: 2010, off: 300 }, { m: 'tower', u: 2330, off: -330 },
      { m: 'van', u: 2490, off: -280 }, { m: 'car_red', u: 2440, off: 250 }, { m: 'suv_dark', u: 2200, off: 290 },
      ...along('lamp', 1860, 2600, 185, -112), ...along('lamp', 1950, 2600, 185, 112),
      { m: 'waterfall', x: 1480, u: 2000, f: 1.5 }, { m: 'waterfall', x: 1520, u: 2262, f: 1.5 }, { m: 'waterfall', x: 1480, u: 2520, f: 1.5 },
      { m: 'rock_m', x: 1380, u: 1980 }, { m: 'rock_s', x: 1610, u: 2240 }, { m: 'rock_m', x: 1380, u: 2500 },
      { m: 'flower_bed', u: 2100, off: -250 }, { m: 'flower_bed', u: 2560, off: 280 },
    ],
    fences: [[[-420, 2250], [-250, 2250], [-250, 2400]], [[190, 1900], [190, 2100]]],
    density: 0.48,
  },
  {
    // S4: hills and tree groves
    n: 4,
    items: [
      { m: 'hill_a', u: 2900, off: -430, f: 1.7 }, { m: 'hill_b', u: 3020, off: 430, f: 1.6 }, { m: 'hill_b', u: 3330, off: 500, f: 1.8 },
      { m: 'hill_b', u: 3350, off: -400, f: 1.5 }, { m: 'hill_a', u: 2750, off: 700, f: 1.4 }, { m: 'hill_b', u: 3100, off: -700, f: 1.4 },
      { m: 'hill_a', u: 3500, off: 700, f: 1.3 }, { m: 'hill_a', u: 2700, off: -300, f: 1.2 },
      ...along('lamp', 2780, 3480, 230, -112), ...along('lamp', 2860, 3480, 230, 112),
      { m: 'rock_m', u: 3150, off: -190 }, { m: 'rock_s', u: 3250, off: 200 }, { m: 'rock_m', u: 2880, off: 190 },
    ],
    decor: WOODS,
    density: 0.78,
  },
  {
    // S5: river valley with long bridges
    n: 5,
    ponds: [[420, 3990, 180, 80], [1480, 4200, 170, 75]],
    items: [
      { m: 'bridge_long', x: 420, u: 3975 }, { m: 'bridge_long', x: 1480, u: 4185 },
      { m: 'lamp', x: 215, u: 3975 }, { m: 'lamp', x: 625, u: 3975 }, { m: 'lamp', x: 1300, u: 4185 }, { m: 'lamp', x: 1660, u: 4185 },
      { m: 'flower_bed', u: 3700, off: 280 }, { m: 'flower_bed', u: 4300, off: -290 }, { m: 'flower_bed', u: 4000, off: 320 },
      { m: 'rock_m', x: 250, u: 4100 }, { m: 'rock_s', x: 620, u: 3880 }, { m: 'rock_m', x: 1680, u: 4090 },
      { m: 'tower', u: 3660, off: -320 },
    ],
    fences: [[[-190, 3620], [-190, 3900]], [[190, 4260], [190, 4420]]],
    density: 0.46,
  },
  {
    // S6: orchard terraces and a second waterfall chain
    n: 6,
    ponds: [[1520, 4880, 95, 50], [1550, 5120, 100, 52]],
    items: [
      ...orchard(180, 760, 4560, 5240), ...orchard(1220, 1420, 4520, 4720),
      ...along('terrace_wall', 4500, 5260, 190, 130, 1.0, true), ...along('terrace_wall', 4500, 5260, 190, 256, 1.0, true),
      ...along('terrace_wall', 4500, 5260, 190, 382, 1.0, true), ...along('terrace_wall', 4500, 5260, 190, 508, 1.0, true),
      ...along('terrace_wall', 4500, 5260, 190, 634, 1.0, true),
      { m: 'waterfall', x: 1520, u: 4912, f: 1.5 }, { m: 'waterfall', x: 1550, u: 5152, f: 1.5 },
      { m: 'rock_m', x: 1420, u: 4890 }, { m: 'rock_s', x: 1650, u: 5130 },
      ...along('lamp', 4540, 5280, 185, -112), ...along('lamp', 4620, 5280, 185, 112),
    ],
    decor: ORCHARD,
    density: 0.3,
  },
  {
    // S7: gate plateau
    n: 7,
    items: [
      { m: 'gate_k1', x: 887, u: 5850, fixed: true },
      { m: 'tower', u: 5720, off: -330 }, { m: 'tower', u: 5720, off: 330 },
      ...along('lamp', 5440, 5800, 120, -170), ...along('lamp', 5440, 5800, 120, 170),
      { m: 'flower_bed', u: 5500, off: -280 }, { m: 'flower_bed', u: 5500, off: 290 }, { m: 'flower_bed', u: 5380, off: 400 },
      { m: 'flower_bed', u: 5380, off: -410 }, { m: 'flower_bed', u: 5620, off: -400 }, { m: 'flower_bed', u: 5620, off: 410 },
      { m: 'rock_m', u: 5800, off: -420 }, { m: 'rock_s', u: 5800, off: 430 },
    ],
    fences: [[[-240, 5500], [-240, 5780], [-400, 5800]], [[240, 5500], [240, 5780], [400, 5800]]],
    density: 0.42,
  },
];
