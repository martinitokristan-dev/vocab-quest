import { hash01 } from '../../src/core/rng';
import { archModel } from './arch';
import { blob, Grid } from './build';
import { FINE, vehicle } from './props';
import type { VoxelModel } from './types';

/** Kingdom 3 entrance: marble arch with a red roof, the capitol colours. */
export const K3_ARCH = archModel({
  name: 'k3_arch',
  w: 34,
  d: 5,
  pillar: 8,
  ph: 20,
  lintel: 5,
  mats: { pillar: 'marble', trim: 'marbleDark', lintel: 'slate', roof: 'roofRedA', accent: 'roofRedDark', crest: 'gold' },
});

/** Tall narrow cypress. */
export const CYPRESS: VoxelModel = (() => {
  const g = new Grid(4, 4, 15);
  g.box(1, 1, 0, 3, 3, 2, 'T');
  blob(g, 1.5, 1.5, 8, 2.0, 2.0, 6.6, 81);
  return g.toModel('cypress', { T: 'trunk', L: 'cypress', D: 'cypressDark', H: 'leafHi' }, FINE);
})();

/** Marble obelisk on a stepped base with a gold tip. */
export const OBELISK: VoxelModel = (() => {
  const g = new Grid(5, 5, 18);
  g.box(0, 0, 0, 5, 5, 1, 'D');
  g.box(1, 1, 1, 4, 4, 2, 'D');
  for (let z = 2; z < 15; z++) g.box(2, 2, z, 3, 3, z + 1, 'M');
  g.box(1, 1, 2, 4, 4, 4, 'M');
  g.box(2, 2, 15, 3, 3, 16, 'G');
  g.box(2, 2, 16, 3, 3, 17, 'G');
  return g.toModel('obelisk', { D: 'marbleDark', M: 'marble', G: 'gold' }, FINE);
})();

/** Repeatable colonnade bay: two columns, a plinth and an entablature. */
export const COLONNADE: VoxelModel = (() => {
  const g = new Grid(12, 4, 13);
  g.box(0, 0, 0, 12, 4, 1, 'D');
  for (const x of [1, 8]) g.box(x, 1, 1, x + 3, 3, 10, 'M');
  for (const x of [1, 8]) g.box(x, 1, 1, x + 3, 3, 2, 'D');
  g.box(0, 0, 10, 12, 4, 12, 'D');
  g.box(0, 3, 10, 12, 4, 11, 'M');
  g.box(1, 0, 12, 11, 3, 13, 'M');
  return g.toModel('k3_colonnade', { D: 'marbleDark', M: 'marble' }, FINE);
})();

/** Terrace wall: stone course topped with a hedge, repeats along the contour. */
export const TERRACE: VoxelModel = (() => {
  const g = new Grid(14, 2, 6);
  for (let z = 0; z < 4; z++) for (let x = 0; x < 14; x++) g.box(x, 0, z, x + 1, 2, z + 1, hash01(91, x, z) < 0.3 ? 'D' : 'S');
  g.box(0, 0, 4, 14, 2, 5, 'L');
  for (let x = 0; x < 14; x += 2) g.set(x, 0, 5, 'H');
  return g.toModel('terrace_wall', { S: 'slate', D: 'slateDark', L: 'cypress', H: 'vine' }, FINE);
})();

/** Vine row for the vineyard terraces. */
export const VINES: VoxelModel = (() => {
  const g = new Grid(10, 2, 4);
  for (let x = 0; x < 10; x += 3) g.box(x, 0, 0, x + 1, 1, 3, 'P');
  g.box(0, 0, 3, 10, 1, 4, 'P');
  g.box(0, 1, 0, 10, 2, 3, 'V');
  for (let x = 1; x < 10; x += 2) g.set(x, 1, 2, 'G');
  return g.toModel('k3_vines', { P: 'woodDark', V: 'vine', G: 'grape' }, FINE);
})();

/** Cliff-edge block: stacked stone cubes with a foam fringe on the front course. */
export const CLIFF: VoxelModel = (() => {
  const g = new Grid(16, 6, 7);
  for (let x = 0; x < 16; x++) {
    const hh = 3 + Math.floor(hash01(92, x) * 4);
    for (let y = 0; y < 6; y++) for (let z = 0; z < hh - Math.floor(y / 2); z++) g.set(x, y, z, hash01(93, x, y, z) < 0.35 ? 'D' : 'S');
    g.set(x, 5, 0, 'F');
  }
  return g.toModel('k3_cliff', { S: 'peakStone', D: 'peakDark', F: 'snow' }, FINE);
})();

/** Belvedere: round gazebo with eight columns and a copper cone roof. */
export const BELVEDERE: VoxelModel = (() => {
  const W = 15;
  const D = 9;
  const g = new Grid(W, D, 20);
  const ell = (x: number, y: number, r: number): boolean => ((x - 7) / (7.4 * r)) ** 2 + ((y - 4) / (3.9 * r)) ** 2 <= 1;
  for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) if (ell(x, y, 1)) g.set(x, y, 0, 'D');
  const cols: Array<[number, number]> = [[1, 4], [3, 1], [7, 0], [11, 1], [13, 4], [11, 7], [7, 8], [3, 7]];
  for (const [x, y] of cols) g.box(x, y, 1, x + 1, y + 1, 10, 'M');
  for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) if (ell(x, y, 1.04)) g.set(x, y, 10, 'D');
  for (let k = 0; k < 8; k++) {
    const r = 1.1 - k * 0.12;
    for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) if (ell(x, y, r)) g.set(x, y, 11 + k, k % 2 ? 'C' : 'c');
  }
  g.set(7, 4, 19, 'G');
  return g.toModel('k3_belvedere', { D: 'marbleDark', M: 'marble', C: 'copper', c: 'roofGreenB', G: 'gold' }, FINE);
})();

/** Statue on a marble plinth. */
export const STATUE: VoxelModel = (() => {
  const g = new Grid(5, 5, 15);
  g.box(0, 0, 0, 5, 5, 1, 'D');
  g.box(1, 1, 1, 4, 4, 5, 'M');
  g.box(1, 1, 5, 4, 4, 6, 'D');
  g.box(1, 2, 6, 2, 3, 9, 'B');
  g.box(3, 2, 6, 4, 3, 9, 'B');
  g.box(1, 2, 9, 4, 3, 12, 'B');
  g.box(2, 2, 12, 3, 3, 14, 'B');
  g.box(3, 2, 12, 4, 3, 15, 'B');
  return g.toModel('k3_statue', { D: 'marbleDark', M: 'marble', B: 'bronze' }, FINE);
})();

/** Wide ceremonial steps (finale). */
export const STEPS: VoxelModel = (() => {
  const g = new Grid(34, 7, 6);
  for (let z = 0; z < 6; z++) g.box(0, 0, z, 34, 7 - z, z + 1, z % 2 ? 'M' : 'D');
  return g.toModel('k3_steps', { M: 'marble', D: 'marbleDark' }, FINE);
})();

/** Conical peak silhouette (K3 horizon). */
function peak(name: string, w: number, d: number, h: number, seed: number): VoxelModel {
  const g = new Grid(w, d, h);
  for (let z = 0; z < h; z++) {
    const s = 1 - z / h;
    const rx = (w / 2) * s;
    const ry = (d / 2) * s + 0.4;
    for (let y = 0; y < d; y++) {
      for (let x = 0; x < w; x++) {
        if (((x + 0.5 - w / 2) / rx) ** 2 + ((y + 0.5 - d / 2) / ry) ** 2 > 1) continue;
        const r = hash01(seed, x, y, z);
        g.set(x, y, z, z >= h - 4 ? 'W' : r < 0.35 ? 'D' : 'S');
      }
    }
  }
  return g.toModel(name, { S: 'peakStone', D: 'peakDark', W: 'snow' }, FINE);
}

export const PEAK_A = peak('peak_a', 15, 9, 17, 101);
export const PEAK_B = peak('peak_b', 11, 7, 20, 102);

export const K3_VAN: VoxelModel = vehicle('k3_van', 11, 8, true, 'vanCream');
export const K3_SUV: VoxelModel = vehicle('k3_suv', 9, 7, false, 'carGreen');
export const K3_SEDAN: VoxelModel = vehicle('k3_sedan', 9, 6, false, 'carBlue');
