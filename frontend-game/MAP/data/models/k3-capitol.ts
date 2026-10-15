import { hash01 } from '../../src/core/rng';
import { Grid } from './build';
import { FINE } from './props';
import type { VoxelModel } from './types';

/**
 * Grand capitol (K3 finale): marble hall with two wings, a colonnaded portico with pediment, red clay
 * roofs and a copper dome on a drum. Drawn at about 1.3x so it dwarfs the reference capitol.
 */
export const CAPITOL_GRAND: VoxelModel = (() => {
  const W = 59;
  const D = 12;
  const H = 40;
  const g = new Grid(W, D, H);
  const X0 = 19;
  const X1 = 40;
  const WING_D = 8;
  const WALL = 13;
  const CWALL = 15;
  for (let z = 0; z < CWALL; z++) {
    for (let y = 0; y < D - 1; y++) {
      for (let x = 0; x < W; x++) {
        const centre = x >= X0 && x < X1;
        if (!centre && (y >= WING_D || z >= WALL)) continue;
        g.set(x, y, z, (x + z) % 2 === 0 ? 'W' : hash01(8, x, z) < 0.5 ? 'w' : 'W');
      }
    }
  }
  for (const x of [3, 8, 13, 45, 50, 55]) {
    g.box(x - 1, WING_D - 1, 2, x + 3, WING_D, 11, 'Q');
    g.box(x, WING_D - 1, 3, x + 2, WING_D, 10, 'N');
  }
  for (const x of [0, 18, 40, 58]) g.box(x, WING_D - 1, 0, x + 1, WING_D, WALL, 'Q');
  // portico
  g.box(X0, D - 2, 0, X1, D - 1, 11, '.');
  for (const x of [21, 25, 29, 33, 37]) g.box(x, D - 2, 0, x + 2, D - 1, 11, 'Q');
  g.box(28, D - 3, 0, 33, D - 2, 8, 'M');
  g.box(X0 + 1, D - 2, 11, X1 - 1, D - 1, 13, 'Q');
  for (const x of [22, 26, 34]) g.box(x, D - 3, 3, x + 2, D - 2, 9, 'N');
  for (let k = 0; k < 9; k++) {
    const x0 = X0 + 1 + k;
    const x1 = X1 - 1 - k;
    for (let x = x0; x < x1; x++) {
      const edge = x === x0 || x === x1 - 1 || k === 0;
      for (let y = D - 3; y < D - 1; y++) g.set(x, y, 13 + k, edge ? 'Q' : 'G');
    }
  }
  g.box(X0 + 3, D - 1, 0, X1 - 3, D, 1, 'S');
  g.box(X0 + 5, D - 1, 1, X1 - 5, D, 2, 'S');
  // wing roofs
  for (let y = 0; y < WING_D; y++) {
    for (let x = 0; x < W; x++) {
      if (x >= X0 && x < X1) continue;
      const d = x < X0 ? x : W - 1 - x;
      const top = Math.min(WALL + 1 + (WING_D - 1 - y), WALL + 1 + Math.floor(d * 0.7), WALL + 8);
      for (let z = WALL; z < top; z++) g.set(x, y, z, (x + y + z) % 2 === 0 ? 'a' : 'b');
    }
  }
  // centre roof behind the pediment
  for (let y = 0; y < WING_D; y++) {
    for (let x = X0; x < X1; x++) {
      const top = CWALL + 3 + (WING_D - 1 - y) * 0 + Math.floor((WING_D - 1 - y) * 0.4);
      for (let z = CWALL; z < top; z++) g.set(x, y, z, (x + y + z) % 2 === 0 ? 'a' : 'b');
    }
  }
  // drum and dome
  const cx = (X0 + X1 - 1) / 2;
  for (let z = 18; z < 24; z++) {
    for (let y = 0; y < 7; y++) {
      for (let x = X0 + 4; x < X1 - 4; x++) {
        if (((x - cx) / 8) ** 2 + ((y - 3) / 3.2) ** 2 > 1) continue;
        g.set(x, y, z, z === 21 ? 'Q' : (x - Math.round(cx)) % 3 === 0 ? 'N' : 'W');
      }
    }
  }
  for (let k = 0; k < 11; k++) {
    const r = Math.sqrt(1 - (k / 11) ** 2);
    for (let y = 0; y < 7; y++) {
      for (let x = X0 + 3; x < X1 - 3; x++) {
        if (((x - cx) / (9.5 * r + 0.3)) ** 2 + ((y - 3) / (3.7 * r + 0.3)) ** 2 > 1) continue;
        g.set(x, y, 24 + k, k % 3 === 2 ? 'Y' : 'C');
      }
    }
  }
  g.box(Math.round(cx), 3, 35, Math.round(cx) + 1, 4, 40, 'G');
  return g.toModel(
    'k3_capitol_grand',
    { W: 'wall', w: 'wallAlt', N: 'navy', Q: 'marble', M: 'door', S: 'stepGray', G: 'gold', Y: 'marbleDark', C: 'copper', a: 'roofRedA', b: 'roofRedB' },
    FINE,
  );
})();
