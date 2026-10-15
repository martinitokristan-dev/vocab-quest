import { hash01 } from '../../src/core/rng';
import { blob, Grid } from './build';
import type { VoxelModel } from './types';

/** Smoke model: cube tree with a 2x2 trunk and three canopy layers. */
export const TREE_OAK: VoxelModel = {
  name: 'tree_oak',
  size: [6, 6, 6],
  layers: [
    ['......', '......', '..TT..', '..TT..', '......', '......'],
    ['......', '......', '..TT..', '..TT..', '......', '......'],
    ['......', '......', '..TT..', '..TT..', '......', '......'],
    ['.LLLL.', 'LLLLLL', 'LLLLLL', 'LLLLLL', 'LLLLLL', '.LLLL.'],
    ['.LLLL.', 'LLLLLL', 'LLDLLL', 'LLLLLL', 'LLLLLL', '.LLLL.'],
    ['......', '.LLLL.', '.LLLL.', '.LLLL.', '.LLLL.', '......'],
  ],
  legend: { T: 'trunk', L: 'leaf', D: 'leafDark' },
  anchor: [54, 118],
};

export const BUSH: VoxelModel = {
  name: 'bush',
  size: [4, 3, 2],
  layers: [['.LL.', 'LLLL', 'LLLL'], ['....', '.LL.', '.LL.']],
  legend: { L: 'leaf' },
  anchor: [36, 52],
};

/** Half-size voxels (9 x 5 x 7 units) for landmarks and detailed props. */
export const FINE = 0.5;

const LEAF_LEGEND = { T: 'trunk', L: 'leaf', D: 'leafDark', H: 'leafHi', Y: 'bloomY', O: 'bloomO', P: 'bloomP', W: 'bloomW' };

function oak(name: string, r: number, trunkH: number, rz: number, ry: number, seed: number): VoxelModel {
  const w = 2 * r + 2;
  const d = Math.ceil(ry) * 2 + 1;
  const h = trunkH + Math.ceil(rz) * 2 + 1;
  const g = new Grid(w, d, h);
  const cy = (d - 1) / 2;
  for (let z = 0; z < trunkH + 1; z++) {
    g.set(r, Math.floor(cy), z, 'T');
    g.set(r + 1, Math.floor(cy), z, 'T');
  }
  blob(g, r + 0.5, cy, trunkH + rz, r + 0.6, ry + 0.4, rz + 0.3, seed);
  return g.toModel(name, LEAF_LEGEND, FINE);
}

export const OAK_S = oak('oak_s', 2, 1, 2, 1.4, 11);
export const OAK_M = oak('oak_m', 3, 2, 2.6, 1.9, 23);
export const OAK_L = oak('oak_l', 4, 3, 3.2, 2.4, 37);
export const OAK_XL = oak('oak_xl', 5, 3, 3.8, 2.8, 41);

function bush(name: string, bloom: string | undefined, seed: number): VoxelModel {
  const g = new Grid(7, 5, 3);
  blob(g, 3, 2, 1, 3.6, 2.4, 1.7, seed, bloom);
  return g.toModel(name, LEAF_LEGEND, FINE);
}

export const BUSH_PLAIN = bush('bush_plain', undefined, 5);
export const BUSH_Y = bush('bush_y', 'Y', 6);
export const BUSH_O = bush('bush_o', 'O', 7);
export const BUSH_P = bush('bush_p', 'P', 8);
export const BUSH_W = bush('bush_w', 'W', 9);

function hill(name: string, seed: number): VoxelModel {
  const w = 17;
  const d = 9;
  const h = 10;
  const g = new Grid(w, d, h);
  for (let z = 0; z < h - 1; z++) {
    const inset = Math.floor(z * 0.85);
    const yin = Math.floor(z / 2);
    for (let y = yin; y < d - yin; y++) {
      for (let x = inset; x < w - inset; x++) {
        const r = hash01(seed, x, y, z);
        g.set(x, y, z, z >= h - 4 ? (r < 0.6 ? 'G' : 'L') : r < 0.5 ? 'G' : r < 0.75 ? 'T' : 'S');
      }
    }
  }
  return g.toModel(name, { G: 'hillGrass', T: 'hillDirt', S: 'hillStone', L: 'leaf' }, FINE);
}

export const HILL_A = hill('hill_a', 3);
export const HILL_B = hill('hill_b', 4);

function rock(name: string, w: number, d: number, h: number, seed: number): VoxelModel {
  const g = new Grid(w, d, h);
  for (let z = 0; z < h; z++) {
    for (let y = 0; y < d; y++) {
      for (let x = 0; x < w; x++) {
        if (z > 0 && hash01(seed, x, y, z) < 0.35) continue;
        g.set(x, y, z, hash01(seed + 1, x, y, z) < 0.5 ? 'R' : 'K');
      }
    }
  }
  return g.toModel(name, { R: 'rock', K: 'rockDark' }, FINE);
}

export const ROCK_S = rock('rock_s', 3, 2, 2, 5);
export const ROCK_M = rock('rock_m', 4, 3, 3, 6);

export const LILY: VoxelModel = (() => {
  const g = new Grid(4, 3, 1);
  g.box(0, 0, 0, 4, 3, 1, 'P');
  g.set(0, 0, 0, '.');
  g.set(3, 2, 0, '.');
  g.set(2, 0, 0, '.');
  return g.toModel('lily', { P: 'lily' }, FINE);
})();

/** Fence tile (18 units wide): post plus two rails. */
export const FENCE: VoxelModel = (() => {
  const g = new Grid(2, 1, 4);
  g.box(0, 0, 0, 1, 1, 4, 'W');
  g.box(1, 0, 1, 2, 1, 2, 'w');
  g.box(1, 0, 3, 2, 1, 4, 'w');
  return g.toModel('fence', { W: 'wood', w: 'plank' }, 0.65);
})();

export const BRIDGE: VoxelModel = (() => {
  const g = new Grid(13, 6, 8);
  g.box(0, 1, 3, 13, 5, 4, 'B');
  for (let x = 0; x < 13; x += 2) g.box(x, 1, 3, x + 1, 5, 4, 'b');
  for (const x of [0, 12]) for (const y of [1, 4]) g.box(x, y, 0, x + 1, y + 1, 3, 'P');
  for (const x of [0, 4, 8, 12]) for (const y of [0, 5]) g.box(x, y, 4, x + 1, y + 1, 8, 'P');
  for (const y of [0, 5]) {
    g.box(0, y, 6, 13, y + 1, 7, 'R');
    g.box(0, y, 4, 13, y + 1, 5, 'R');
  }
  return g.toModel('bridge', { B: 'plank', b: 'wood', P: 'woodDark', R: 'plank' }, FINE);
})();

/** Playground tower with pyramid roof; the slide runs down to the left. */
export const TOWER: VoxelModel = (() => {
  const g = new Grid(11, 6, 17);
  for (const x of [4, 10]) for (const y of [1, 4]) g.box(x, y, 0, x + 1, y + 1, 9, 'P');
  g.box(4, 1, 8, 11, 5, 9, 'W');
  for (let x = 4; x < 11; x++) {
    g.set(x, 4, 9, 'P');
    g.set(x, 1, 9, 'P');
  }
  for (let z = 0; z < 7; z++) {
    const i = Math.floor(z * 0.7);
    for (let y = Math.max(0, 1 - Math.floor(z / 3)); y <= 4 + Math.floor(z / 3) && y < 6; y++) {
      for (let x = 3 + i; x <= 11 - i - 1; x++) g.set(x, y, 10 + z, (x + y + z) % 2 ? 'a' : 'b');
    }
  }
  const steps: Array<[number, number, number]> = [[3, 6, 8], [2, 4, 6], [1, 2, 4], [0, 0, 2]];
  for (const [x, z0, z1] of steps) g.box(x, 2, z0, x + 1, 6, z1, 'S');
  return g.toModel('tower', { P: 'woodDark', W: 'wood', a: 'roofGreenA', b: 'roofGreenB', S: 'roofGreenA' }, FINE);
})();

export const LAMP: VoxelModel = (() => {
  const g = new Grid(3, 2, 14);
  g.box(1, 1, 0, 2, 2, 11, 'P');
  g.box(0, 0, 8, 3, 2, 12, 'Y');
  g.box(0, 0, 12, 3, 2, 13, 'P');
  return g.toModel('lamp', { P: 'lampPost', Y: 'lampYellow' }, FINE);
})();

export function vehicle(name: string, w: number, h: number, cargo: boolean, body: string, glass = 'glass'): VoxelModel {
  const d = 5;
  const g = new Grid(w, d, h);
  if (cargo) {
    g.box(0, 0, 1, w - 3, d, h - 1, 'V');
    g.box(w - 3, 0, 1, w, d, 4, 'V');
    g.box(w - 3, 0, 4, w - 1, d - 1, 5, 'V');
    g.box(w - 3, d - 1, 3, w - 1, d, 5, 'G');
    g.box(w - 2, 0, 3, w - 1, d, 4, 'G');
  } else {
    g.box(0, 0, 1, w, d, 4, 'V');
    g.box(2, 0, 4, w - 2, d - 1, h, 'V');
    g.box(3, d - 2, 4, w - 3, d - 1, h - 1, 'G');
  }
  for (const x of [1, w - 3]) {
    g.box(x, d - 1, 0, x + 2, d, 2, 'T');
    g.box(x, 0, 0, x + 2, 1, 2, 'T');
  }
  return g.toModel(name, { V: body, G: glass, T: 'tyre' }, FINE);
}

export const VAN: VoxelModel = vehicle('van', 11, 8, true, 'vanWhite');
export const CAR_RED: VoxelModel = vehicle('car_red', 9, 6, false, 'carRed');
export const SUV_DARK: VoxelModel = vehicle('suv_dark', 9, 7, false, 'carDark');

export const WATERFALL: VoxelModel = (() => {
  const g = new Grid(4, 2, 11);
  for (let z = 0; z < 11; z++) {
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 2; y++) {
        g.set(x, y, z, z < 2 || (x + (z >> 2)) % 2 === 0 ? 'F' : 'f');
      }
    }
  }
  g.box(0, 0, 10, 4, 2, 11, 'R');
  return g.toModel('waterfall', { F: 'foam', f: 'fall', R: 'rock' }, FINE);
})();
