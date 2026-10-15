import { along } from './k1';
import type { DecorMix, SceneItem, SegmentSpec } from './types';

/** Kingdom 2 (Bayan ng Prosperidad): palms, acacias and sandstone town; mesas on the horizon. */
export const K2_DECOR: DecorMix = [
  ['palm_a', 0.15], ['palm_b', 0.13], ['acacia', 0.16], ['bush', 0.1], ['bush_y', 0.08], ['bush_o', 0.08],
  ['rock_s', 0.08], ['rock_m', 0.06],
];

const STALLS = ['k2_stall_red', 'k2_stall_blue', 'k2_stall_yellow'] as const;

/** Market stalls alternating sides and awning colours along the route. */
function market(u0: number, u1: number, step: number, off: number): SceneItem[] {
  const out: SceneItem[] = [];
  let i = 0;
  for (let u = u0; u <= u1; u += step, i++) out.push({ m: STALLS[i % 3], u, off: i % 2 ? off : -off });
  return out;
}

/** Ring of lamps and benches around a plaza centre (flattened to match the oblique view). */
function ring(cx: number, cu: number, rx: number, ru: number, n: number): SceneItem[] {
  const out: SceneItem[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push({ m: i % 2 ? 'k2_bench' : 'lamp', x: Math.round(cx + Math.cos(a) * rx), u: Math.round(cu + Math.sin(a) * ru), fixed: true });
  }
  return out;
}

export const K2_SEGMENTS: readonly SegmentSpec[] = [
  {
    // S1: cloud stairs arrival, town arch, plaza
    n: 1,
    items: [
      { m: 'k2_arch', x: 600, u: 88, fixed: true },
      { m: 'lamp', x: 405, u: 100, fixed: true }, { m: 'lamp', x: 795, u: 100, fixed: true },
      { m: 'hall', x: 260, u: 480, fixed: true },
      { m: 'hall_steps', x: 260, u: 360, fixed: true },
      { m: 'k2_banner', u: 560, off: -280 }, { m: 'k2_banner', u: 700, off: 290 },
      { m: 'k2_stall_red', u: 470, off: -240 }, { m: 'k2_stall_blue', u: 640, off: 250 }, { m: 'k2_stall_yellow', u: 780, off: -260 },
      { m: 'k2_fountain', u: 520, off: 330 }, { m: 'k2_bench', u: 450, off: 150 }, { m: 'k2_bench', u: 700, off: -140 },
      ...along('lamp', 560, 860, 150, 112),
    ],
    density: 0.4,
  },
  {
    // S2: market street
    n: 2,
    items: [
      ...market(950, 1700, 125, 150),
      { m: 'k2_banner', u: 1010, off: 330 }, { m: 'k2_banner', u: 1300, off: -330 }, { m: 'k2_banner', u: 1610, off: 330 },
      ...along('lamp', 1000, 1740, 185, 95), ...along('lamp', 1090, 1740, 185, -95),
      { m: 'k2_bench', u: 1180, off: 160 }, { m: 'k2_bench', u: 1480, off: -170 }, { m: 'k2_annex', u: 1100, off: -440 },
    ],
    density: 0.36,
  },
  {
    // S3: lake promenade and fountain
    n: 3,
    ponds: [[1250, 2300, 330, 125]],
    items: [
      { m: 'k2_fountain', u: 2010, off: 190 },
      { m: 'k2_pier', x: 960, u: 2310 }, { m: 'k2_boat', x: 1210, u: 2280 }, { m: 'k2_boat', x: 1420, u: 2380 },
      { m: 'reed', x: 1000, u: 2200 }, { m: 'reed', x: 1480, u: 2190 }, { m: 'reed', x: 1560, u: 2300 },
      ...along('lamp', 1840, 2620, 195, 100), ...along('lamp', 1930, 2620, 195, -100),
      { m: 'k2_bench', u: 2150, off: 150 }, { m: 'k2_bench', u: 2550, off: -150 },
      { m: 'k2_banner', u: 1900, off: 340 }, { m: 'k2_stall_blue', u: 2450, off: 240 },
    ],
    density: 0.4,
  },
  {
    // S4: plaza ring, colosseum annexes and mesas
    n: 4,
    items: [
      { m: 'k2_fountain', x: 600, u: 3150 }, ...ring(600, 3150, 170, 85, 8),
      { m: 'k2_annex', x: 210, u: 3330 }, { m: 'k2_annex', x: 1560, u: 2900 },
      { m: 'mesa_a', u: 3480, off: -560, f: 1.3 }, { m: 'mesa_b', u: 2760, off: 560, f: 1.3 }, { m: 'mesa_a', u: 3400, off: 520, f: 1.4 },
      ...market(2800, 3500, 175, 170),
      ...along('lamp', 2760, 3500, 190, 105),
    ],
    density: 0.38,
  },
  {
    // S5: stone bridges over wide lakes
    n: 5,
    ponds: [[330, 3900, 150, 90], [1540, 4180, 150, 90]],
    items: [
      { m: 'k2_stone_bridge', x: 330, u: 3885 }, { m: 'k2_stone_bridge', x: 1540, u: 4165 },
      { m: 'k2_boat', x: 280, u: 3930 }, { m: 'k2_boat', x: 1580, u: 4210 },
      { m: 'reed', x: 210, u: 3840 }, { m: 'reed', x: 1430, u: 4120 },
      { m: 'lamp', x: 160, u: 3885 }, { m: 'lamp', x: 500, u: 3885 }, { m: 'lamp', x: 1370, u: 4165 }, { m: 'lamp', x: 1710, u: 4165 },
      { m: 'mesa_b', u: 4300, off: 520, f: 1.2 }, { m: 'mesa_a', u: 3700, off: -560, f: 1.3 },
      { m: 'k2_bench', u: 3800, off: -170 }, { m: 'k2_stall_red', u: 4300, off: -230 },
    ],
    density: 0.4,
  },
  {
    // S6: boat pier and reed marsh
    n: 6,
    ponds: [[1300, 4800, 330, 140]],
    items: [
      { m: 'k2_pier', x: 1000, u: 4800 }, { m: 'k2_boat', x: 1180, u: 4770 }, { m: 'k2_boat', x: 1420, u: 4850 }, { m: 'k2_boat', x: 1330, u: 4710 },
      { m: 'reed', x: 1000, u: 4700 }, { m: 'reed', x: 1040, u: 4900 }, { m: 'reed', x: 1600, u: 4720 }, { m: 'reed', x: 1620, u: 4870 },
      { m: 'reed', x: 1250, u: 4930 }, { m: 'reed', x: 1450, u: 4660 }, { m: 'reed', x: 1130, u: 4940 },
      ...along('lamp', 4500, 5260, 190, 105), ...along('lamp', 4590, 5260, 190, -105),
      { m: 'k2_stall_yellow', u: 5050, off: 240 }, { m: 'k2_banner', u: 4600, off: 340 },
    ],
    density: 0.36,
  },
  {
    // S7: colosseum hero and the top gate
    n: 7,
    items: [
      { m: 'gate_k2', x: 1000, u: 5850, fixed: true },
      { m: 'k2_colosseum', u: 5600, off: -380, f: 1.4 },
      { m: 'k2_annex', u: 5700, off: 380 },
      ...along('lamp', 5440, 5800, 120, 165), ...along('lamp', 5440, 5800, 120, -165),
      { m: 'k2_banner', u: 5380, off: 330 }, { m: 'k2_fountain', u: 5330, off: -200 },
      { m: 'mesa_a', u: 5950, off: -700, f: 1.2 }, { m: 'mesa_b', u: 5950, off: 650, f: 1.2 },
    ],
    flags: [],
    density: 0.36,
  },
];
