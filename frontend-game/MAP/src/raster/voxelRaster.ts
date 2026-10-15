import type { Material, VoxelModel } from '../../data/models/types';
import { hash01 } from '../core/rng';
import { createSurface, ctxOf, type Surface } from './canvas';
import { shade } from './materials';

export const CELL_W = 18;
export const CELL_D = 10;
export const CELL_H = 14;

export interface RasterOptions {
  /** Pixels per world unit. */
  scale?: number;
  seed?: number;
  /** Injected for tests. */
  createCanvas?: (w: number, h: number) => Surface;
}

function isEmpty(ch: string | undefined): boolean {
  return ch === undefined || ch === ' ' || ch === '.';
}

/** Char at voxel (x, y, z), or undefined outside the model. */
export function voxelAt(model: VoxelModel, x: number, y: number, z: number): string | undefined {
  const ch = model.layers[z]?.[y]?.[x];
  return isEmpty(ch) ? undefined : ch;
}

export interface FaceCounts {
  voxels: number;
  top: number;
  front: number;
}

/**
 * Exposed-face culling: a top face is exposed when no voxel sits above it, a front face when no voxel
 * sits in front of it (larger y). Only these two faces exist in the oblique projection.
 */
export function exposedFaces(model: VoxelModel): FaceCounts {
  const [w, d, h] = model.size;
  const out: FaceCounts = { voxels: 0, top: 0, front: 0 };
  for (let z = 0; z < h; z++) {
    for (let y = 0; y < d; y++) {
      for (let x = 0; x < w; x++) {
        if (!voxelAt(model, x, y, z)) continue;
        out.voxels++;
        if (!voxelAt(model, x, y, z + 1)) out.top++;
        if (!voxelAt(model, x, y + 1, z)) out.front++;
      }
    }
  }
  return out;
}

/** Sprite size in world units at scale 1: (w*18) x (d*10 + h*14), times the model's unit factor. */
export function spriteSize(model: VoxelModel): { w: number; h: number } {
  const [w, d, h] = model.size;
  const u = model.unit ?? 1;
  return { w: w * CELL_W * u, h: (d * CELL_D + h * CELL_H) * u };
}

/**
 * Rasterises a voxel model back to front with the DESIGN 2.3 lighting: top +14%, 2-unit left highlight,
 * 2-unit right shadow, 1-unit outline, seeded +/-5% noise.
 */
export function rasterizeVoxelModel(
  model: VoxelModel,
  materials: Readonly<Record<string, Material>>,
  opts: RasterOptions = {},
): Surface {
  const scale = opts.scale ?? 1;
  const seed = opts.seed ?? 1;
  const make = opts.createCanvas ?? createSurface;
  const [w, d, h] = model.size;
  const size = spriteSize(model);
  const surface = make(Math.ceil(size.w * scale), Math.ceil(size.h * scale));
  const ctx = ctxOf(surface);
  const S = scale;
  const u = model.unit ?? 1;
  const cw = CELL_W * u;
  const cd = CELL_D * u;
  const chh = CELL_H * u;
  const edge = Math.max(1, 2 * u);
  for (let y = 0; y < d; y++) {
    for (let z = 0; z < h; z++) {
      for (let x = 0; x < w; x++) {
        const ch = voxelAt(model, x, y, z);
        if (!ch) continue;
        const mat = materials[model.legend[ch]];
        if (!mat) continue;
        const n = 1 + (hash01(seed, x, y, z) - 0.5) * 0.1 * mat.noise;
        const sx = x * cw * S;
        const topY = (y * cd + (h - 1 - z) * chh) * S;
        if (!voxelAt(model, x, y, z + 1)) {
          ctx.fillStyle = shade(mat.top ?? mat.base, (mat.emissive ? 1 : 1.14) * n);
          ctx.fillRect(sx, topY, cw * S, cd * S);
          if (!mat.emissive) {
            ctx.strokeStyle = 'rgba(0,0,0,0.18)';
            ctx.lineWidth = S;
            ctx.strokeRect(sx + S / 2, topY + S / 2, cw * S - S, cd * S - S);
          }
        }
        if (!voxelAt(model, x, y + 1, z)) {
          const fy = topY + cd * S;
          ctx.fillStyle = shade(mat.base, n);
          ctx.fillRect(sx, fy, cw * S, chh * S);
          if (!mat.emissive) {
            ctx.fillStyle = shade(mat.base, n * 1.1);
            ctx.fillRect(sx, fy, edge * S, chh * S);
            ctx.fillStyle = shade(mat.base, n * 0.86);
            ctx.fillRect(sx + (cw - edge) * S, fy, edge * S, chh * S);
            ctx.strokeStyle = 'rgba(0,0,0,0.18)';
            ctx.lineWidth = S;
            ctx.strokeRect(sx + S / 2, fy + S / 2, cw * S - S, chh * S - S);
          }
        }
      }
    }
  }
  return surface;
}
