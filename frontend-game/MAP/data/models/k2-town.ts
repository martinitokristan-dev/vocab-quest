import { archModel } from './arch';
import { Grid } from './build';
import { HALL } from './hall';
import { FINE } from './props';
import type { VoxelModel } from './types';

/** Kingdom 2 top gate (sandstone, teal roof). */
export const GATE_K2 = archModel({
  name: 'gate_k2',
  w: 36,
  d: 5,
  pillar: 8,
  ph: 19,
  lintel: 5,
  mats: { pillar: 'sandstone', trim: 'wallLight', lintel: 'sandstoneDark', roof: 'roofTeal', accent: 'roofTealDark', crest: 'gold' },
});

/** Town arch: kingdom 2 entrance with a pennant string under the lintel. */
export const K2_ARCH = archModel({
  name: 'k2_arch',
  w: 34,
  d: 5,
  pillar: 8,
  ph: 18,
  lintel: 5,
  pennants: true,
  mats: { pillar: 'sandstone', trim: 'wallLight', lintel: 'terracotta', roof: 'terracotta', accent: 'awnBlue', crest: 'gold' },
});

function stall(name: string, a: string, b: string): VoxelModel {
  const g = new Grid(11, 5, 10);
  g.box(1, 0, 0, 10, 1, 6, 'B');
  g.box(1, 3, 0, 10, 5, 3, 'W');
  for (const x of [0, 10]) for (const y of [0, 4]) g.box(x, y, 0, x + 1, y + 1, 8, 'P');
  for (let x = 0; x < 11; x++) {
    const c = x % 2 ? 'a' : 'b';
    g.box(x, 0, 8, x + 1, 5, 9, c);
    g.box(x, 4, 7, x + 1, 5, 8, c);
    g.box(x, 1, 9, x + 1, 4, 10, c);
  }
  g.box(2, 3, 3, 4, 4, 4, 'Y');
  g.box(5, 3, 3, 7, 4, 4, 'O');
  g.box(8, 3, 3, 9, 4, 4, 'R');
  return g.toModel(name, { B: 'woodDark', W: 'wood', P: 'woodDark', a, b, Y: 'bloomY', O: 'bloomO', R: 'awnRed' }, FINE);
}

export const STALL_RED = stall('k2_stall_red', 'awnRed', 'awnWhite');
export const STALL_BLUE = stall('k2_stall_blue', 'awnBlue', 'awnWhite');
export const STALL_YELLOW = stall('k2_stall_yellow', 'awnYellow', 'awnWhite');

/** Three-tier plaza fountain. */
export const FOUNTAIN: VoxelModel = (() => {
  const g = new Grid(13, 7, 9);
  const ell = (x: number, y: number, rx: number, ry: number): boolean => ((x - 6) / rx) ** 2 + ((y - 3) / ry) ** 2 <= 1;
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 13; x++) {
      if (!ell(x, y, 6.4, 3.4)) continue;
      g.set(x, y, 0, 'S');
      g.set(x, y, 1, ell(x, y, 5.2, 2.5) ? 'w' : 'S');
      if (!ell(x, y, 5.2, 2.5)) g.set(x, y, 2, 'S');
    }
  }
  g.box(5, 2, 2, 8, 5, 5, 'S');
  for (let y = 1; y < 6; y++) for (let x = 4; x < 9; x++) if (ell(x, y, 3, 2)) g.set(x, y, 5, y === 3 ? 'w' : 'S');
  g.box(6, 3, 6, 7, 4, 9, 'f');
  return g.toModel('k2_fountain', { S: 'sandstone', w: 'water', f: 'foam' }, FINE);
})();

/** Fiesta pennant string between two poles (1 voxel deep). */
export const BANNER: VoxelModel = (() => {
  const g = new Grid(22, 1, 10);
  g.box(0, 0, 0, 1, 1, 10, 'P');
  g.box(21, 0, 0, 22, 1, 10, 'P');
  g.box(1, 0, 8, 21, 1, 9, 'S');
  const cols = ['a', 'b', 'c', 'd'];
  for (let x = 2; x < 21; x += 2) {
    const c = cols[(x >> 1) % 4];
    g.box(x, 0, 6, x + 1, 1, 8, c);
    g.box(x, 0, 5, x + 1, 1, 6, x % 4 === 0 ? c : '.');
  }
  return g.toModel('k2_banner', { P: 'woodDark', S: 'awnWhite', a: 'awnRed', b: 'awnYellow', c: 'awnBlue', d: 'bloomP' }, FINE);
})();

export const BENCH: VoxelModel = (() => {
  const g = new Grid(7, 2, 4);
  g.box(0, 0, 2, 7, 2, 3, 'W');
  g.box(0, 0, 3, 7, 1, 4, 'W');
  for (const x of [0, 6]) g.box(x, 1, 0, x + 1, 2, 2, 'P');
  return g.toModel('k2_bench', { W: 'wood', P: 'woodDark' }, FINE);
})();

/** Arched stone bridge, 33 voxels long, for the K2 lakes. */
export const STONE_BRIDGE: VoxelModel = (() => {
  const W = 33;
  const g = new Grid(W, 6, 9);
  const cx = (W - 1) / 2;
  g.box(0, 1, 3, W, 5, 4, 'S');
  for (let x = 0; x < W; x++) {
    const rise = Math.round(2 * Math.cos(((x - cx) / cx) * (Math.PI / 2)));
    if (rise > 0) g.box(x, 1, 4, x + 1, 5, 4 + rise, 'S');
  }
  for (const x of [0, 1, 2, W - 3, W - 2, W - 1]) g.box(x, 1, 0, x + 1, 5, 3, 'D');
  for (const x of [9, 10, 22, 23]) g.box(x, 1, 0, x + 1, 5, 3, 'D');
  for (const y of [0, 5]) {
    g.box(0, y, 4, W, y + 1, 7, 'S');
    for (let x = 1; x < W; x += 4) g.box(x, y, 7, x + 2, y + 1, 8, 'D');
  }
  return g.toModel('k2_stone_bridge', { S: 'sandstone', D: 'sandstoneDark' }, FINE);
})();

export const PIER: VoxelModel = (() => {
  const g = new Grid(14, 5, 4);
  g.box(0, 1, 2, 14, 4, 3, 'B');
  for (let x = 0; x < 14; x += 2) g.box(x, 1, 2, x + 1, 4, 3, 'b');
  for (let x = 1; x < 14; x += 4) {
    g.box(x, 1, 0, x + 1, 2, 2, 'P');
    g.box(x, 3, 0, x + 1, 4, 2, 'P');
  }
  return g.toModel('k2_pier', { B: 'plank', b: 'wood', P: 'woodDark' }, FINE);
})();

/** Town annex: sandstone hall with a teal hip roof, navy windows and a door. */
export const ANNEX: VoxelModel = (() => {
  const W = 20;
  const D = 8;
  const g = new Grid(W, D, 14);
  g.box(0, 0, 0, W, D - 1, 9, 'W');
  for (let x = 2; x < W - 2; x += 4) g.box(x, D - 2, 3, x + 2, D - 1, 7, 'N');
  g.box(W / 2 - 2, D - 2, 0, W / 2 + 2, D - 1, 5, 'M');
  g.box(0, D - 2, 0, W, D - 1, 1, 'T');
  g.box(0, D - 2, 8, W, D - 1, 9, 'T');
  for (let k = 0; k < 5; k++) g.box(k, 0 + (k > 2 ? 1 : 0), 9 + k, W - k, D - 1 - Math.min(k, 2), 10 + k, k % 2 ? 'b' : 'a');
  g.box(W / 2 - 1, 2, 14 - 1, W / 2 + 1, 4, 14, 'Y');
  return g.toModel('k2_annex', { W: 'sandstone', N: 'navy', M: 'door', T: 'wallLight', a: 'roofTeal', b: 'roofTealDark', Y: 'gold' }, FINE);
})();

/** Colosseum hero: the reference hall re-skinned in sandstone and teal. */
export const COLOSSEUM: VoxelModel = {
  ...HALL,
  name: 'k2_colosseum',
  legend: { ...HALL.legend, W: 'sandstone', w: 'sandstoneDark', B: 'roofTeal', R: 'roofTealDark', r: 'woodDark', a: 'roofTeal', b: 'roofTealDark' },
};
