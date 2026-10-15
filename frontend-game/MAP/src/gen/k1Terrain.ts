import { K1_PLAZAS } from '../../data/scenes/k1';
import { K1_TERRAIN } from '../../data/scenes/k1-terrain';
import { K1_ANCHORS_REF, K1_S1_REF_Y0 } from '../../data/spines';
import { hash01 } from '../core/rng';
import { CELL_D, CELL_W, MAT_DIRT, MAT_GRASS, MAT_PATH, MAT_PLANK, MAT_STONE, MAT_WATER, pathDistance, type CellInfo } from './carve';
import { valueNoise } from './heightfield';

/** First world grid row of K1 S1 (17740 / 10). */
export const K1_ROW0 = K1_S1_REF_Y0 / CELL_D;
/** Half width of the reference path in K1 S1 (the reference path is about 40 units wide). */
export const K1_PATH_HALF_W = 19;
/** Wooden bridge rect (reference px): water wins over path here. */
const BRIDGE = [548, 585, 668, 668] as const;

export function inPlaza(x: number, y: number): boolean {
  for (const [x0, y0, x1, y1] of K1_PLAZAS) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return true;
  return false;
}

function nextToWater(gi: number, rj: number): boolean {
  return k1Class(gi - 1, rj) === 'w' || k1Class(gi + 1, rj) === 'w' || k1Class(gi, rj - 1) === 'w' || k1Class(gi, rj + 1) === 'w';
}

const CURL: ReadonlyArray<readonly [number, number]> = [...K1_ANCHORS_REF, [1700, 557]];

/** Distance (reference px) to the L1-L13 route including the curl at the right edge. */
function distToCurl(x: number, y: number): number {
  let best = Infinity;
  for (let i = 1; i < CURL.length; i++) {
    const [ax, ay] = CURL[i - 1];
    const [bx, by] = CURL[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), y - (ay + dy * t)));
  }
  return best;
}

/** Terrain class of a K1 S1 cell: '.', 'w', 's' or 'p' (measured geometry plus hand plazas, rivers widened). */
function rawClass(gi: number, rj: number): string {
  const row = K1_TERRAIN[rj];
  return row ? (row[gi] ?? '.') : '.';
}

export function k1Class(gi: number, rj: number): string {
  let ch = rawClass(gi, rj);
  // the reference rivers are wider than the thin measured mask (trees hide their banks): widen by one cell sideways
  if (ch === '.' && rj >= 21 && (rawClass(gi - 1, rj) === 'w' || rawClass(gi + 1, rj) === 'w')) ch = 'w';
  if (ch !== 'p' && ch !== 'w' && inPlaza(gi * CELL_W + 9, rj * CELL_D + 5)) return 'p';
  return ch;
}

/**
 * K1 S1 override of the terrain sampler (DESIGN 14.0: hand-authored, no noise lakes). Returns false for
 * cells outside K1 S1 so the caller falls back to the global noise terrain.
 */
export function k1Cell(gi: number, gj: number, out: CellInfo): boolean {
  const rj = gj - K1_ROW0;
  if (rj < 0 || rj >= K1_TERRAIN.length) return false;
  const cls = k1Class(gi, rj);
  const cx = gi * CELL_W + 9;
  const cy = rj * CELL_D + 5;
  if (cls === 'w') {
    const nearBridge = cx >= BRIDGE[0] - 20 && cx <= BRIDGE[2] + 20 && cy >= BRIDGE[1] - 20 && cy <= BRIDGE[3] + 20;
    if (nearBridge || pathDistance(gi, gj) > K1_PATH_HALF_W) {
      out.h = -1;
      out.m = MAT_WATER;
      return true;
    }
  }
  if (pathDistance(gi, gj) <= K1_PATH_HALF_W || cls === 'p') {
    out.h = 1;
    // the route beyond the reference's L1-L13 curl is a wooden boardwalk (DESIGN 3.4), not cobble
    out.m = cls !== 'p' && distToCurl(cx, cy) > 30 ? MAT_PLANK : MAT_PATH;
    return true;
  }
  if (cls === 's') {
    out.h = 1 + (hash01(gi, rj, 3) < 0.35 ? 1 : 0);
    out.m = MAT_STONE;
    return true;
  }
  // river banks: raised stone / dirt terraces beside the water, two cubes high
  if (cy >= 200 && nextToWater(gi, rj) && pathDistance(gi, gj) > 34) {
    out.h = 2;
    out.m = hash01(gi, rj, 12) < 0.62 ? MAT_STONE : MAT_DIRT;
    return true;
  }
  // grass: gentle clumped terraces (0..2) with a few loose stone cubes
  const n = valueNoise(gi / 3.2, rj / 3.2, 21) * 0.7 + valueNoise(gi / 1.4, rj / 1.4, 22) * 0.3;
  out.h = n < 0.34 ? 0 : n < 0.68 ? 1 : 2;
  out.m = hash01(gi, rj, 8) < 0.03 ? MAT_STONE : MAT_GRASS;
  return true;
}
