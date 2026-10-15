import { WORLD_W } from '../../data/world';

/** Integer lattice hash to [0, 1), allocation free. */
export function lattice(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise at (x, y) in lattice units. */
export function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = lattice(x0, y0, seed);
  const b = lattice(x0 + 1, y0, seed);
  const c = lattice(x0, y0 + 1, seed);
  const d = lattice(x0 + 1, y0 + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export const MAX_LEVEL = 4;

/**
 * Terrain level 0..4 at a continuous world-cell position (cx = x / 18, cy = y / 10). Octaves of 14, 6 and
 * 3 cells. A pure function of world coordinates, so neighbouring segments agree exactly (seamless tiling).
 */
export function levelAt(cx: number, cy: number, seed = 7): number {
  const v =
    0.55 * valueNoise(cx / 14, cy / 14, seed) +
    0.3 * valueNoise(cx / 6, cy / 6, seed + 1) +
    0.15 * valueNoise(cx / 3, cy / 3, seed + 2);
  const l = Math.floor((v - 0.2) * 7);
  return l < 0 ? 0 : l > MAX_LEVEL ? MAX_LEVEL : l;
}

/** Low-frequency water mask value (0..1); small values become lakes. */
export function waterNoise(cx: number, cy: number, seed = 11): number {
  return valueNoise(cx / 22, cy / 22, seed) * 0.8 + valueNoise(cx / 8, cy / 8, seed + 1) * 0.2;
}

/** Far-field perspective scale (DESIGN 2.3): 1 at refY >= 450, 0.78 at 180, back to 1 at 0. */
export function farfieldScale(refY: number): number {
  if (refY >= 450) return 1;
  if (refY >= 180) return 0.78 + ((refY - 180) / 270) * 0.22;
  if (refY <= 0) return 1;
  return 1 - 0.22 * (refY / 180);
}

export interface FarRow {
  /** Reference-space top of the strip (0 = top of K1 S1). */
  readonly y0: number;
  readonly depth: number; // CELL_D * s
  readonly s: number;
  readonly w: number; // cube width, 18 * s
  readonly columns: number;
}

/**
 * K1 S1 far-field rows (DESIGN 2.3): generated from refY = 450 upward, each row `10*s(y_c)` deep, the last
 * row clipped at refY = 0. Returned in draw order (top of the screen first).
 */
export function farfieldRows(top = 0, bottom = 450): FarRow[] {
  const rows: FarRow[] = [];
  let yb = bottom; // bottom edge of the next row
  while (yb > top + 1e-6) {
    // fixed-point on the centre scale: the row depth depends on s at its own centre
    let depth = 10 * farfieldScale(yb - 5);
    for (let i = 0; i < 3; i++) depth = 10 * farfieldScale(yb - depth / 2);
    const y0 = Math.max(top, yb - depth);
    const s = farfieldScale((y0 + yb) / 2);
    const w = 18 * s;
    rows.push({ y0, depth: yb - y0, s, w, columns: Math.ceil(WORLD_W / w) });
    yb = y0;
  }
  return rows.reverse();
}
