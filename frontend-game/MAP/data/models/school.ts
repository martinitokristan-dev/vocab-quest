import { hash01 } from '../../src/core/rng';
import { Grid } from './build';
import { FINE } from './props';
import type { VoxelModel } from './types';

/**
 * East Prosperidad Central Elementary School: tan wall with a sign panel, green two-tone tiled roof with a
 * ridge cap and dark eave trim, framed navy windows, door and steps. Text (DepEd logo, school name) is a
 * canvas decal.
 */
export const SCHOOL: VoxelModel = (() => {
  const W = 43;
  const D = 8;
  const WALL = 18;
  const H = 24;
  const g = new Grid(W, D, H);
  for (let z = 0; z < WALL; z++) {
    for (let y = 0; y < D; y++) {
      for (let x = 0; x < W; x++) {
        g.set(x, y, z, (x + z) % 2 === 0 ? 'W' : hash01(9, x, z) < 0.5 ? 'w' : 'W');
      }
    }
  }
  // corner trim, sign panel, framed windows, door and steps
  for (const x of [0, W - 1]) g.box(x, D - 1, 0, x + 1, D, WALL, 'F');
  g.box(14, D - 1, 5, 33, D, 16, 'P');
  for (const x of [5, 9, 36, 40]) {
    g.box(x - 1, D - 1, 5, x + 3, D, 14, 'F');
    g.box(x, D - 1, 6, x + 2, D, 13, 'N');
  }
  g.box(20, D - 1, 0, 26, D, 10, 'F');
  g.box(21, D - 1, 0, 25, D, 9, 'M');
  g.box(18, D - 1, 0, 28, D, 1, 'S');
  // front gable (west wing): a triangular tan gable end with a window, standing proud of the roof slope
  for (let k = 0; k < 6; k++) g.box(7 + k, D - 1, WALL, 22 - k, D, WALL + 1 + k, k === 0 ? 'F' : 'P');
  g.box(13, D - 1, WALL + 1, 16, D, WALL + 3, 'N');
  // roof: the front slope rises one level per row toward the back, hipped at both ends
  for (let y = 0; y < D; y++) {
    for (let x = 0; x < W; x++) {
      const slope = WALL + 1 + (D - 1 - y);
      const left = WALL + 1 + Math.floor(x * 0.85);
      const right = WALL + 1 + Math.floor((W - 1 - x) * 0.55);
      const top = Math.min(slope, left, right, H);
      for (let z = WALL; z < top; z++) {
        // tile rows: two-cell tiles, offset by half a tile on every other row
        let ch = ((x + (z % 2)) >> 1) % 2 === 0 ? 'a' : 'b';
        if (z === WALL && y === D - 1) ch = 'e'; // dark eave trim
        if (z === top - 1 && top === H) ch = 'r'; // ridge cap
        g.set(x, y, z, ch);
      }
    }
  }
  return g.toModel(
    'school',
    { W: 'wall', w: 'wallAlt', P: 'wallLight', N: 'navy', M: 'door', S: 'stepGray', F: 'pillar', a: 'roofGreenA', b: 'roofGreenB', e: 'roofGreenDark', r: 'roofGreenRidge' },
    FINE,
  );
})();
