import { hash01 } from '../../src/core/rng';
import { blob, Grid } from './build';
import { FINE } from './props';
import type { VoxelModel } from './types';

function palm(name: string, lean: number): VoxelModel {
  const g = new Grid(11, 5, 17);
  let tx = 5 - lean;
  for (let z = 0; z < 12; z++) {
    if (z > 0 && z % (lean ? 4 : 99) === 0) tx += lean ? 1 : 0;
    g.set(tx, 2, z, 'T');
  }
  const top = 12;
  g.box(tx - 1, 1, top, tx + 2, 4, top + 1, 'D');
  for (let i = 1; i <= 4; i++) {
    const drop = i > 2 ? 1 : 0;
    const z = top + (i < 3 ? 1 : 0) - drop;
    g.set(tx + i, 2, z, 'F');
    g.set(tx - i, 2, z, 'F');
    if (i <= 2) {
      g.set(tx, 2 + i, top - (i - 1), 'F');
      g.set(tx, 2 - i, top - (i - 1) + 0, 'F');
      g.set(tx + i, 1, z - 1 + (i > 1 ? 0 : 1), 'f');
      g.set(tx - i, 3, z - 1 + (i > 1 ? 0 : 1), 'f');
    }
  }
  g.set(tx, 2, top + 1, 'F');
  g.box(tx, 2, top + 1, tx + 1, 3, top + 2, 'F');
  return g.toModel(name, { T: 'palmTrunk', D: 'palmLeafDark', F: 'palmLeaf', f: 'palmLeafDark' }, FINE);
}

export const PALM_A = palm('palm_a', 0);
export const PALM_B = palm('palm_b', 1);

/** Acacia: slim trunk and a flat umbrella canopy. */
export const ACACIA: VoxelModel = (() => {
  const g = new Grid(12, 7, 11);
  for (let z = 0; z < 6; z++) g.set(5, 3, z, 'T');
  g.set(6, 3, 5, 'T');
  g.set(4, 3, 4, 'T');
  blob(g, 5.5, 3, 7, 5.6, 3.2, 1.5, 61);
  return g.toModel('acacia', { T: 'trunk', L: 'leaf', D: 'leafDark', H: 'leafHi' }, FINE);
})();

export const REED: VoxelModel = (() => {
  const g = new Grid(5, 2, 6);
  const heights = [3, 5, 4, 6, 3];
  for (let x = 0; x < 5; x++) {
    g.box(x, x % 2, 0, x + 1, (x % 2) + 1, heights[x] - 1, 'R');
    g.set(x, x % 2, heights[x] - 1, 'r');
  }
  return g.toModel('reed', { R: 'reed', r: 'reedTop' }, FINE);
})();

export const BOAT: VoxelModel = (() => {
  const g = new Grid(10, 4, 8);
  g.box(1, 0, 0, 9, 4, 1, 'H');
  g.box(0, 1, 1, 10, 3, 2, 'H');
  g.box(0, 0, 2, 10, 1, 3, 'H');
  g.box(0, 3, 2, 10, 4, 3, 'H');
  g.box(5, 1, 1, 6, 2, 8, 'M');
  g.box(6, 1, 3, 9, 2, 7, 'S');
  return g.toModel('k2_boat', { H: 'boatWood', M: 'woodDark', S: 'sail' }, FINE);
})();

/** Flat-topped mesa silhouette (K2 horizon). */
function mesa(name: string, w: number, d: number, h: number, seed: number): VoxelModel {
  const g = new Grid(w, d, h);
  for (let z = 0; z < h; z++) {
    const inset = Math.floor(z * 0.3);
    const yin = Math.floor(z / 5);
    for (let y = yin; y < d - yin; y++) {
      for (let x = inset; x < w - inset; x++) {
        const r = hash01(seed, x, y, z);
        let ch = z < h * 0.35 ? 'A' : z < h * 0.7 ? 'B' : 'A';
        if (r < 0.18) ch = 'D';
        if (z === h - 1) ch = r < 0.7 ? 'G' : 'A';
        g.set(x, y, z, ch);
      }
    }
  }
  return g.toModel(name, { A: 'mesaA', B: 'mesaB', D: 'mesaDark', G: 'hillGrass' }, FINE);
}

export const MESA_A = mesa('mesa_a', 19, 9, 9, 71);
export const MESA_B = mesa('mesa_b', 13, 7, 12, 72);
