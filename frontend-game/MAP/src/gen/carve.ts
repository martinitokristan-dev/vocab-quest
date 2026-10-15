import { PATH_HALF_W, WORLD_H, WORLD_W } from '../../data/world';
import { computeLayout } from '../core/layout';
import { smoothstep } from '../core/math';
import { levelAt, waterNoise } from './heightfield';
import { pondAt } from './ponds';
import { TAPER, edgeDistance, isSkyCell } from './zones';

export const CELL_W = 18;
export const CELL_D = 10;
export const GRID_COLS = Math.ceil(WORLD_W / CELL_W); // 99
export const GRID_ROWS = Math.ceil(WORLD_H / CELL_D); // 1863
export const BLEED = 64;
const FIELD_R = 100; // distances beyond this are not tracked

export const MAT_GRASS = 0;
export const MAT_PATH = 1;
export const MAT_WATER = 2;
export const MAT_STONE = 3;
export const MAT_DIRT = 4;
/** Wooden boardwalk planks (K1 beyond level 13). */
export const MAT_PLANK = 5;
/** Open sky between kingdoms (nothing is drawn by the terrain pass). */
export const MAT_SKY = 6;

let field: Float32Array | null = null;

/** Distance (world units, capped at FIELD_R + 1) from each cell centre to the nearest route sample. */
function buildField(): Float32Array {
  const f = new Float32Array(GRID_COLS * GRID_ROWS).fill(FIELD_R + 1);
  const layout = computeLayout();
  for (const k of [1, 2, 3] as const) {
    for (const p of layout.paths[k].pts) {
      const gi0 = Math.max(0, Math.floor((p.x - FIELD_R) / CELL_W));
      const gi1 = Math.min(GRID_COLS - 1, Math.ceil((p.x + FIELD_R) / CELL_W));
      const gj0 = Math.max(0, Math.floor((p.y - FIELD_R) / CELL_D));
      const gj1 = Math.min(GRID_ROWS - 1, Math.ceil((p.y + FIELD_R) / CELL_D));
      for (let gj = gj0; gj <= gj1; gj++) {
        const dy = gj * CELL_D + CELL_D / 2 - p.y;
        for (let gi = gi0; gi <= gi1; gi++) {
          const dx = gi * CELL_W + CELL_W / 2 - p.x;
          const d = Math.hypot(dx, dy);
          const idx = gj * GRID_COLS + gi;
          if (d < f[idx]) f[idx] = d;
        }
      }
    }
  }
  return f;
}

/** Distance from the cell centre to the nearest route sample (FIELD_R + 1 when far). */
export function pathDistance(gi: number, gj: number): number {
  if (gi < 0 || gj < 0 || gi >= GRID_COLS || gj >= GRID_ROWS) return FIELD_R + 1;
  field ??= buildField();
  return field[gj * GRID_COLS + gi];
}

/** Distance from an arbitrary world point (cell resolution). */
export function pathDistanceAt(x: number, y: number): number {
  return pathDistance(Math.floor(x / CELL_W), Math.floor(y / CELL_D));
}

export interface CellInfo {
  /** Height level; -1 is water. */
  h: number;
  m: number;
}

/**
 * Terrain of one world cell: noise heightfield, path plateau (level 1, smoothed over ~64 units so steps stay
 * at most one level), lakes away from the route, stone on peaks.
 */
export function sampleCell(gi: number, gj: number, out: CellInfo): CellInfo {
  const cx = gi + 0.5;
  const cy = gj + 0.5;
  const raw = levelAt(cx, cy);
  const dist = pathDistance(gi, gj);
  if (dist <= PATH_HALF_W) {
    out.h = 1;
    out.m = MAT_PATH;
    return out;
  }
  if (isSkyCell(gi, gj)) {
    out.h = 0;
    out.m = MAT_SKY;
    return out;
  }
  const edge = edgeDistance(gi, gj);
  if (edge === Infinity && pondAt(gi * CELL_W + CELL_W / 2, gj * CELL_D + CELL_D / 2)) {
    out.h = -1;
    out.m = MAT_WATER;
    return out;
  }
  if (edge === Infinity && dist > FIELD_R && waterNoise(cx, cy) < 0.33) {
    out.h = -1;
    out.m = MAT_WATER;
    return out;
  }
  const t = smoothstep(PATH_HALF_W, PATH_HALF_W + 64, dist);
  let h = Math.round(1 + (raw - 1) * t);
  // land edges of the sky seams step up one level per 40 units so the island reads as a terrace
  if (edge < TAPER) h = Math.min(h, 1 + Math.floor(edge / 40));
  out.h = h;
  out.m = h >= 4 ? MAT_STONE : h === 3 && ((gi * 7 + gj * 13) & 7) === 0 ? MAT_DIRT : MAT_GRASS;
  return out;
}
