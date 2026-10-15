import { blob, Grid } from './build';
import { FINE } from './props';
import type { VoxelModel } from './types';

const LEAF = { T: 'trunk', L: 'leaf', D: 'leafDark', H: 'leafHi', O: 'awnRed', Y: 'bloomY' };

/** Orchard tree: medium oak canopy with red fruit voxels. */
export const APPLE: VoxelModel = (() => {
  const g = new Grid(8, 6, 9);
  for (let z = 0; z < 3; z++) {
    g.set(3, 2, z, 'T');
    g.set(4, 2, z, 'T');
  }
  blob(g, 3.5, 2.5, 5, 3.6, 2.4, 2.8, 51, 'O');
  return g.toModel('apple', LEAF, FINE);
})();

/** Garden flower bed: soil planter with two rows of blooms. */
export const FLOWER_BED: VoxelModel = (() => {
  const g = new Grid(10, 3, 3);
  g.box(0, 0, 0, 10, 3, 1, 'S');
  g.box(0, 0, 1, 10, 3, 2, 'G');
  const blooms = ['A', 'B', 'C', 'D'];
  for (let x = 0; x < 10; x++) {
    g.set(x, 0, 2, blooms[x % 4]);
    g.set(x, 1, 2, blooms[(x + 2) % 4]);
    g.set(x, 2, 2, blooms[(x + 1) % 4]);
  }
  return g.toModel('flower_bed', { S: 'planter', G: 'leafDark', A: 'bloomY', B: 'bloomP', C: 'bloomO', D: 'bloomW' }, FINE);
})();

/** Long plank bridge (K1 S5 river valley): rails, posts and cross planks, 41 voxels wide. */
export const BRIDGE_LONG: VoxelModel = (() => {
  const W = 41;
  const g = new Grid(W, 6, 8);
  g.box(0, 1, 3, W, 5, 4, 'B');
  for (let x = 0; x < W; x += 2) g.box(x, 1, 3, x + 1, 5, 4, 'b');
  for (const x of [0, 1, W - 2, W - 1]) for (const y of [1, 4]) g.box(x, y, 0, x + 1, y + 1, 3, 'P');
  for (let x = 6; x < W - 6; x += 7) for (const y of [1, 4]) g.box(x, y, 0, x + 1, y + 1, 3, 'P');
  for (let x = 0; x < W; x += 5) for (const y of [0, 5]) g.box(x, y, 4, x + 1, y + 1, 8, 'P');
  for (const y of [0, 5]) {
    g.box(0, y, 6, W, y + 1, 7, 'R');
    g.box(0, y, 4, W, y + 1, 5, 'R');
  }
  return g.toModel('bridge_long', { B: 'plank', b: 'wood', P: 'woodDark', R: 'plank' }, FINE);
})();
