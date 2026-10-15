import { hash01 } from '../../src/core/rng';
import { Grid } from './build';
import { FINE } from './props';
import type { VoxelModel } from './types';

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean => {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
};

/**
 * Bayan ng Prosperidad hall: two-tier round colosseum. Lower tier with blue columns, cream trim band, a
 * slightly inset upper tier with windows, a brown roof rim around a dark courtyard, a green gold-crested
 * pyramid behind and a green-roofed entrance block in front.
 */
export const HALL: VoxelModel = (() => {
  const W = 39;
  const D = 13;
  const H = 21;
  const g = new Grid(W, D, H);
  const cx = (W - 1) / 2;
  const cy = (D - 1) / 2;
  const T1 = { rx: 19.4, ry: 6.4 };
  const T2 = { rx: 18.2, ry: 5.7 };
  for (let z = 0; z < 12; z++) {
    const t = z < 7 ? T1 : T2;
    for (let y = 0; y < D; y++) {
      for (let x = 0; x < W; x++) {
        if (!inEllipse(x, y, cx, cy, t.rx, t.ry)) continue;
        g.set(x, y, z, z === 6 ? 'T' : hash01(3, x, z) < 0.4 ? 'w' : 'W');
      }
    }
  }
  // roof rim (outer ring of the upper tier) around a dark courtyard
  for (let y = 0; y < D; y++) {
    for (let x = 0; x < W; x++) {
      if (!inEllipse(x, y, cx, cy, T2.rx, T2.ry)) continue;
      const inner = inEllipse(x, y, cx, cy, 15.6, 3.6);
      for (let z = 12; z < 14; z++) if (!inner) g.set(x, y, z, hash01(5, x, y) < 0.5 ? 'R' : 'r');
      if (inner) g.set(x, y, 11, 'C');
    }
  }
  // front-facing detail: lower-tier blue columns with dark openings, upper-tier windows
  for (let y = 0; y < D; y++) {
    for (let x = 0; x < W; x++) {
      if (g.get(x, y, 0) !== '.' && g.get(x, y + 1, 0) === '.') {
        if (x % 4 <= 1) g.box(x, y, 0, x + 1, y + 1, 6, 'U');
        else g.box(x, y, 1, x + 1, y + 1, 5, 'N');
      }
      if (g.get(x, y, 8) !== '.' && g.get(x, y + 1, 8) === '.' && x % 3 === 1) g.box(x, y, 8, x + 1, y + 1, 11, 'N');
    }
  }
  // entrance block in front of the lower tier, green hip roof, door and steps
  g.box(16, D - 4, 0, 23, D, 8, 'W');
  g.box(18, D - 1, 0, 21, D, 5, 'N');
  for (let k = 0; k < 3; k++) g.box(15 + k, D - 5 + k, 8 + k, 24 - k, D + (k === 0 ? 0 : 0), 9 + k, k % 2 ? 'b' : 'a');
  // crest pyramid behind the ring
  g.box(15, 0, 14, 24, 4, 16, 'a');
  g.box(17, 0, 16, 22, 3, 18, 'b');
  g.box(19, 0, 18, 20, 2, 20, 'a');
  g.box(19, 0, 20, 20, 1, 21, 'Y');
  return g.toModel(
    'hall',
    { W: 'wall', w: 'wallAlt', T: 'pillar', B: 'roofBrown', R: 'roofBrown', r: 'woodDark', C: 'woodDark', N: 'navy', U: 'colBlue', a: 'roofGreenA', b: 'roofGreenB', Y: 'gold' },
    FINE,
  );
})();

/** Entrance steps in front of the hall (separate low sprite). */
export const HALL_STEPS: VoxelModel = (() => {
  const g = new Grid(11, 5, 3);
  for (let z = 0; z < 3; z++) g.box(z, 0, z, 11 - z, 5 - z * 1, z + 1, 'S');
  return g.toModel('hall_steps', { S: 'stepGray' }, FINE);
})();
