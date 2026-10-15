import { hash01 } from '../../src/core/rng';
import { Grid } from './build';
import { FINE } from './props';
import type { VoxelModel } from './types';

/** Provincial Capitol: tan two-wing hall, red clay tile hipped roofs, central portico with pediment and steps. */
export const CAPITOL: VoxelModel = (() => {
  const W = 47;
  const D = 10;
  const H = 26;
  const g = new Grid(W, D, H);
  const X0 = 15;
  const X1 = 32;
  const WING_D = 7;
  const WALL = 12;
  const CWALL = 13;
  // walls
  for (let z = 0; z < CWALL; z++) {
    for (let y = 0; y < D - 1; y++) {
      for (let x = 0; x < W; x++) {
        const centre = x >= X0 && x < X1;
        if (!centre && (y >= WING_D || z >= WALL)) continue;
        g.set(x, y, z, (x + z) % 2 === 0 ? 'W' : hash01(4, x, z) < 0.5 ? 'w' : 'W');
      }
    }
  }
  // wing windows and corner pillars
  for (const x of [3, 7, 11, 35, 39, 43]) {
    g.box(x - 1, WING_D - 1, 2, x + 3, WING_D, 10, 'Q');
    g.box(x, WING_D - 1, 3, x + 2, WING_D, 9, 'N');
  }
  for (const x of [0, 14, 32, 46]) g.box(x, WING_D - 1, 0, x + 1, WING_D, WALL, 'Q');
  // centre: portico with columns, door, entablature and steps
  g.box(X0, D - 2, 0, X1, D - 1, 9, '.');
  for (const x of [17, 21, 25, 29]) g.box(x, D - 2, 0, x + 2, D - 1, 9, 'Q');
  g.box(21, D - 3, 0, 26, D - 2, 7, 'M');
  g.box(X0 + 1, D - 2, 9, X1 - 1, D - 1, 11, 'Q');
  for (const x of [18, 22, 26]) g.box(x, D - 3, 3, x + 2, D - 2, 8, 'N');
  for (const x of [17, 28]) g.box(x, D - 3, 3, x + 1, D - 2, 8, 'N');
  g.box(21, D - 1, 0, 27, D, 1, 'S');
  g.box(22, D - 1, 1, 26, D, 2, 'S');
  // roofs
  for (let y = 0; y < D - 1; y++) {
    for (let x = 0; x < W; x++) {
      const centre = x >= X0 && x < X1;
      const base = centre ? CWALL : WALL;
      if (!centre && y >= WING_D) continue;
      const slope = base + 1 + (centre ? 2 : 0) + (WING_D - 1 - y);
      const hipL = x < X0 ? base + 1 + Math.floor(x * 0.7) : 99;
      const hipR = x >= X1 ? base + 1 + Math.floor((W - 1 - x) * 0.7) : 99;
      const cap = centre ? 24 : 22;
      const top = Math.min(slope, hipL, hipR, cap);
      for (let z = base; z < top; z++) {
        if (centre && y >= WING_D - 1 && z > base + 1) continue;
        let ch = (x + y + z) % 2 === 0 ? 'a' : 'b';
        if (z === base && y === (centre ? WING_D - 1 : WING_D - 1)) ch = 'e';
        if (z === top - 1 && top === cap) ch = 'r';
        g.set(x, y, z, ch);
      }
    }
  }
  // portico roof slab (top face visible) and a trimmed triangular pediment with a gold tympanum
  g.box(X0 + 1, D - 4, 11, X1 - 1, D - 1, 12, 'Q');
  for (let k = 0; k < 8; k++) {
    const x0 = X0 + 1 + Math.floor(k * 1.0);
    const x1 = X1 - 1 - Math.floor(k * 1.0);
    for (let x = x0; x < x1; x++) {
      const edge = x === x0 || x === x1 - 1 || k === 0;
      for (let y = D - 3; y < D - 1; y++) g.set(x, y, 12 + k, edge ? 'Q' : 'G');
    }
  }
  g.box(X0 + 3, D - 1, 0, X1 - 3, D, 1, 'S');
  return g.toModel(
    'capitol',
    { W: 'wall', w: 'wallAlt', N: 'navy', Q: 'pillar', M: 'door', S: 'stepGray', P: 'wall', G: 'gold', a: 'roofRedA', b: 'roofRedB', e: 'roofRedDark', r: 'roofRedRidge' },
    FINE,
  );
})();
