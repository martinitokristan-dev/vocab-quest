import { along } from './k1';
import type { DecorMix, SceneItem, SegmentSpec } from './types';

/** Kingdom 3 (Provincial Capitol): cypress, slate and marble; conical peaks on the horizon. */
export const K3_DECOR: DecorMix = [
  ['cypress', 0.34], ['oak_m', 0.1], ['oak_s', 0.08], ['bush', 0.1], ['bush_p', 0.08], ['rock_s', 0.1], ['rock_m', 0.08],
];

/** Cliff blocks along the western rim of the sea ellipse centred at (cx, cu) with radii (rx, ru). */
function coast(cx: number, cu: number, rx: number, ru: number, u0: number, u1: number, step: number): SceneItem[] {
  const out: SceneItem[] = [];
  for (let u = u0; u <= u1; u += step) {
    const t = (u - cu) / ru;
    out.push({ m: 'k3_cliff', x: Math.round(cx - rx * Math.sqrt(Math.max(0, 1 - t * t)) - 34), u, fixed: true });
  }
  return out;
}

/** Vineyard rows: vine strips with a terrace wall course between each pair. */
function vineyard(x0: number, x1: number, u0: number, u1: number): SceneItem[] {
  const out: SceneItem[] = [];
  let r = 0;
  for (let u = u0; u <= u1; u += 85, r++) {
    for (let x = x0; x <= x1; x += r % 2 ? 126 : 90) out.push({ m: r % 2 ? 'terrace_wall' : 'k3_vines', u, x });
  }
  return out;
}

const VEHICLES = ['k3_van', 'k3_suv', 'k3_sedan'] as const;

function lot(x0: number, x1: number, u: number): SceneItem[] {
  const out: SceneItem[] = [];
  let i = 0;
  for (let x = x0; x <= x1; x += 125, i++) out.push({ m: VEHICLES[i % 3], x, u });
  return out;
}

export const K3_SEGMENTS: readonly SegmentSpec[] = [
  {
    // S1: cloud stairs arrival, capitol arch, plaza
    n: 1,
    items: [
      { m: 'k3_arch', x: 1174, u: 88, fixed: true },
      { m: 'lamp', x: 980, u: 100, fixed: true }, { m: 'lamp', x: 1370, u: 100, fixed: true },
      { m: 'capitol', x: 1550, u: 480, fixed: true },
      { m: 'obelisk', u: 560, off: 300 }, { m: 'k3_statue', u: 700, off: -300 }, { m: 'k3_colonnade', u: 480, off: -260 },
      { m: 'k3_colonnade', u: 780, off: 280 }, { m: 'k3_statue', u: 330, off: 330 },
      ...along('lamp', 560, 860, 150, 112),
    ],
    density: 0.4,
  },
  {
    // S2: cypress groves and stone terraces
    n: 2,
    items: [
      ...along('terrace_wall', 1010, 1010, 1, 760, 1, true), ...along('terrace_wall', 1010, 1010, 1, 886, 1, true), ...along('terrace_wall', 1010, 1010, 1, 1012, 1, true),
      ...along('terrace_wall', 1220, 1220, 1, 900, 1, true), ...along('terrace_wall', 1220, 1220, 1, 1026, 1, true), ...along('terrace_wall', 1220, 1220, 1, 1152, 1, true),
      ...along('terrace_wall', 1430, 1430, 1, 1060, 1, true), ...along('terrace_wall', 1430, 1430, 1, 1186, 1, true), ...along('terrace_wall', 1430, 1430, 1, 1312, 1, true),
      ...along('terrace_wall', 1640, 1640, 1, 1140, 1, true), ...along('terrace_wall', 1640, 1640, 1, 1266, 1, true), ...along('terrace_wall', 1640, 1640, 1, 1392, 1, true),
      { m: 'obelisk', u: 1250, off: -260 }, { m: 'k3_statue', u: 1560, off: 280 },
      ...along('lamp', 1000, 1740, 185, 100), ...along('lamp', 1090, 1740, 185, -100),
    ],
    decor: [['cypress', 0.6], ['oak_s', 0.06], ['bush', 0.12], ['rock_s', 0.08]],
    density: 0.7,
  },
  {
    // S3: vehicle courtyard and monuments
    n: 3,
    items: [
      ...lot(160, 660, 2150), ...lot(160, 660, 2290), ...lot(1380, 1700, 1960),
      { m: 'obelisk', u: 2500, off: -300 }, { m: 'obelisk', u: 2020, off: 330 }, { m: 'k3_statue', u: 2400, off: 330 },
      { m: 'k3_colonnade', u: 1900, off: -300 }, { m: 'k3_colonnade', u: 2560, off: 290 },
      ...along('lamp', 1850, 2610, 190, 100), ...along('lamp', 1940, 2610, 190, -100),
    ],
    density: 0.36,
  },
  {
    // S4: colonnade drive
    n: 4,
    items: [
      ...along('k3_colonnade', 2780, 3480, 105, -150), ...along('k3_colonnade', 2780, 3480, 105, 150),
      { m: 'k3_statue', u: 3000, off: -420 }, { m: 'k3_statue', u: 3330, off: 420 },
      { m: 'obelisk', u: 2730, off: 430 }, { m: 'obelisk', u: 3500, off: -400 },
      ...along('lamp', 2740, 3500, 95, -75),
    ],
    density: 0.4,
  },
  {
    // S5: coastal cliff edge
    n: 5,
    ponds: [[1900, 4000, 480, 400]],
    items: [
      ...coast(1900, 4000, 480, 400, 3680, 4320, 80),
      { m: 'k3_belvedere', x: 1330, u: 4000 },
      ...along('lamp', 3640, 4420, 195, 100), ...along('lamp', 3730, 4420, 195, -100),
      { m: 'k3_statue', u: 3800, off: -330 }, { m: 'obelisk', u: 4300, off: -320 },
    ],
    density: 0.42,
  },
  {
    // S6: vineyard terraces and belvedere
    n: 6,
    items: [
      ...vineyard(160, 700, 4600, 5120),
      { m: 'k3_belvedere', x: 480, u: 5270 },
      { m: 'k3_colonnade', u: 4700, off: 300 }, { m: 'k3_colonnade', u: 5100, off: -300 },
      ...along('lamp', 4520, 5280, 190, 100), ...along('lamp', 4610, 5280, 190, -100),
    ],
    decor: [['cypress', 0.4], ['bush_p', 0.1], ['bush', 0.1], ['rock_s', 0.08], ['oak_s', 0.08]],
    density: 0.34,
  },
  {
    // S7: capitol summit and finale steps
    n: 7,
    items: [
      { m: 'k3_capitol_grand', x: 774, u: 5779, f: 1.15, fixed: true },
      { m: 'k3_steps', x: 774, u: 5739, fixed: true },
      { m: 'pole_ph', x: 400, u: 5780, fixed: true }, { m: 'pole_e', x: 1150, u: 5780, fixed: true },
      { m: 'k3_statue', x: 470, u: 5710, fixed: true }, { m: 'k3_statue', x: 1078, u: 5710, fixed: true },
      { m: 'cypress', x: 250, u: 5730 }, { m: 'cypress', x: 320, u: 5640 }, { m: 'cypress', x: 1240, u: 5640 }, { m: 'cypress', x: 1300, u: 5730 },
      { m: 'obelisk', u: 5450, off: -300 }, { m: 'obelisk', u: 5430, off: 320 },
      ...along('lamp', 5400, 5640, 120, 150),
    ],
    flags: [
      { kind: 'ph', x: 400, u: 5780 + 226 - 38, w: 56, h: 38 },
      { kind: 'yellow', x: 1150, u: 5780 + 198 - 28, w: 32, h: 28 },
    ],
    decor: [['cypress', 0.4], ['bush_p', 0.1], ['bush', 0.1], ['rock_s', 0.08]],
    density: 0.3,
  },
];
