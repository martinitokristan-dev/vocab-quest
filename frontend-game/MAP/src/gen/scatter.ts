import { PATH_CLEAR, SEG_H, WORLD_W } from '../../data/world';
import { mulberry32 } from '../core/rng';
import { CELL_D, CELL_W, MAT_WATER, pathDistanceAt, sampleCell, type CellInfo } from './carve';

export const OBJ_TREE = 0;
export const OBJ_BUSH = 1;
/** Voxel-model sprite (hand-placed scenes); `m` is the model key, (x, y) the bottom-centre. */
export const OBJ_SPRITE = 4;
/** Flag cloth (w x h); drawn waving later, static for now. */
export const OBJ_FLAG = 5;

export interface SceneObject {
  /** OBJ_TREE, OBJ_BUSH, OBJ_SPRITE or OBJ_FLAG. */
  readonly t: number;
  readonly x: number;
  /** World y of the base (depth-sort key). */
  readonly y: number;
  readonly variant: number;
  readonly phase: number;
  /** OBJ_SPRITE: model key. OBJ_FLAG: 'ph' | 'yellow'. */
  readonly m?: string;
  /** OBJ_SPRITE: draw scale. */
  readonly f?: number;
  /** OBJ_FLAG: cloth size. */
  readonly w?: number;
  readonly h?: number;
  /** Sort key override (world y). */
  readonly ky?: number;
}

const STEP = 120;
const tmp: CellInfo = { h: 0, m: 0 };

/**
 * Jittered-grid scatter (deterministic): trees and bushes off the route (PATH_CLEAR), off water, in
 * world rows [top, top + SEG_H). Sorted by y.
 */
export function scatterObjects(seed: number, top: number): SceneObject[] {
  const rng = mulberry32(seed);
  const out: SceneObject[] = [];
  for (let gy = 0; gy * STEP < SEG_H; gy++) {
    for (let gx = 0; gx * STEP < WORLD_W; gx++) {
      // draw all random numbers first so the sequence is fixed regardless of rejections
      const jx = rng();
      const jy = rng();
      const pick = rng();
      const variant = Math.floor(rng() * 3);
      const phase = rng() * Math.PI * 2;
      const x = gx * STEP + 10 + jx * (STEP - 20);
      const y = top + gy * STEP + 10 + jy * (STEP - 20);
      if (y >= top + SEG_H || pick > 0.55) continue;
      if (pathDistanceAt(x, y) <= PATH_CLEAR) continue;
      sampleCell(Math.floor(x / CELL_W), Math.floor(y / CELL_D), tmp);
      if (tmp.m === MAT_WATER) continue;
      out.push({ t: pick < 0.4 ? OBJ_TREE : OBJ_BUSH, x, y, variant, phase });
    }
  }
  out.sort((a, b) => a.y - b.y);
  return out;
}
