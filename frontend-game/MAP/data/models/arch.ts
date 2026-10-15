import { Grid } from './build';
import { FINE } from './props';
import type { VoxelModel } from './types';

export interface ArchMats {
  readonly pillar: string;
  readonly trim: string;
  readonly lintel: string;
  readonly roof: string;
  readonly accent: string;
  readonly crest: string;
}

export interface ArchOptions {
  readonly name: string;
  /** Voxels: total width, depth, pillar width, pillar height, lintel height. */
  readonly w: number;
  readonly d: number;
  readonly pillar: number;
  readonly ph: number;
  readonly lintel: number;
  readonly mats: ArchMats;
  /** Pennant strings hanging from the lintel (town arch). */
  readonly pennants?: boolean;
}

/**
 * Gateway arch (gates and kingdom entrances): two striped pillars with lanterns, a lintel with a plaque, a
 * cornice and a stepped crest. The opening is `w - 2 * pillar` voxels wide and stays clear for the route.
 */
export function archModel(o: ArchOptions): VoxelModel {
  const { w, d, pillar: p, ph, lintel } = o;
  const h = ph + lintel + 7;
  const g = new Grid(w, d, h);
  const cx = Math.floor(w / 2);
  for (const x0 of [0, w - p]) {
    g.box(x0, 0, 0, x0 + p, d, ph, 'P');
    g.box(x0, 0, 0, x0 + p, d, 2, 'T');
    for (let z = 3; z < ph - 1; z += 4) g.box(x0, d - 1, z, x0 + p, d, z + 1, 'T');
    g.box(x0, 0, ph - 1, x0 + p, d, ph, 'T');
    g.box(x0 + Math.floor(p / 2) - 1, 1, ph, x0 + Math.floor(p / 2) + 1, d - 1, ph + 2, 'Y');
  }
  g.box(0, 0, ph, w, d, ph + lintel, 'L');
  g.box(0, d - 1, ph, w, d, ph + 1, 'T');
  g.box(0, d - 1, ph + lintel - 1, w, d, ph + lintel, 'T');
  g.box(cx - 6, d - 1, ph + 1, cx + 6, d, ph + lintel - 1, 'A');
  g.box(0, 0, ph + lintel, w, d, ph + lintel + 1, 'R');
  for (let k = 0; k < 4; k++) g.box(cx - 5 + k, 1, ph + lintel + 1 + k, cx + 5 - k, d - 1, ph + lintel + 2 + k, k % 2 ? 'R' : 'C');
  if (o.pennants) {
    for (let x = p; x < w - p; x += 2) g.box(x, d - 1, ph - 3 - (x % 4 === 0 ? 1 : 0), x + 1, d, ph, x % 4 === 0 ? 'A' : 'C');
  }
  const m = o.mats;
  return g.toModel(o.name, { P: m.pillar, T: m.trim, L: m.lintel, R: m.roof, A: m.accent, C: m.crest, Y: 'lampYellow' }, FINE);
}

/** Kingdom 1 top gate (green roof, tan walls, as the school and hall). */
export const GATE_K1 = archModel({
  name: 'gate_k1',
  w: 32,
  d: 5,
  pillar: 7,
  ph: 18,
  lintel: 5,
  mats: { pillar: 'wall', trim: 'wallLight', lintel: 'wallAlt', roof: 'roofGreenA', accent: 'roofGreenDark', crest: 'gold' },
});
