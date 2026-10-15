import { hash01 } from '../../src/core/rng';
import type { VoxelModel } from './types';

/** Mutable voxel grid used to author models in code; toModel() freezes it into the ASCII layer format. */
export class Grid {
  readonly w: number;
  readonly d: number;
  readonly h: number;
  private readonly c: string[][][];

  constructor(w: number, d: number, h: number) {
    this.w = w;
    this.d = d;
    this.h = h;
    this.c = [];
    for (let z = 0; z < h; z++) {
      const plane: string[][] = [];
      for (let y = 0; y < d; y++) plane.push(new Array<string>(w).fill('.'));
      this.c.push(plane);
    }
  }

  set(x: number, y: number, z: number, ch: string): void {
    if (x < 0 || y < 0 || z < 0 || x >= this.w || y >= this.d || z >= this.h) return;
    this.c[z][y][x] = ch;
  }

  get(x: number, y: number, z: number): string {
    return this.c[z]?.[y]?.[x] ?? '.';
  }

  /** Fills [x0,x1) x [y0,y1) x [z0,z1). */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, ch: string): void {
    for (let z = z0; z < z1; z++) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.set(x, y, z, ch);
  }

  toModel(name: string, legend: Record<string, string>, unit: number): VoxelModel {
    const layers = this.c.map((plane) => plane.map((row) => row.join('')));
    return {
      name,
      size: [this.w, this.d, this.h],
      layers,
      legend,
      unit,
      anchor: [(this.w * 18 * unit) / 2, (this.d * 10 + this.h * 14) * unit],
    };
  }
}

/** Analytic opaque bounds of a model in sprite px at scale 1 (before any draw scale). */
export function modelBounds(m: VoxelModel): { left: number; top: number; right: number; bottom: number } {
  const [w, d, h] = m.size;
  const u = m.unit ?? 1;
  const cw = 18 * u;
  const cd = 10 * u;
  const chh = 14 * u;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (let z = 0; z < h; z++) {
    for (let y = 0; y < d; y++) {
      const row = m.layers[z]?.[y] ?? '';
      for (let x = 0; x < w; x++) {
        const ch = row[x];
        if (ch === undefined || ch === '.' || ch === ' ') continue;
        const t = y * cd + (h - 1 - z) * chh;
        left = Math.min(left, x * cw);
        right = Math.max(right, (x + 1) * cw);
        top = Math.min(top, t);
        bottom = Math.max(bottom, t + cd + chh);
      }
    }
  }
  return { left, top, right, bottom };
}

/** Ellipsoid blob (leaf canopies, bushes) with seeded highlight / dark / bloom voxels. */
export function blob(
  g: Grid,
  cx: number,
  cy: number,
  cz: number,
  rx: number,
  ry: number,
  rz: number,
  seed: number,
  bloom?: string,
): void {
  for (let z = 0; z < g.h; z++) {
    for (let y = 0; y < g.d; y++) {
      for (let x = 0; x < g.w; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const dz = (z - cz) / rz;
        if (dx * dx + dy * dy + dz * dz > 1.0 + (hash01(seed, x, y, z) - 0.5) * 0.35) continue;
        const r = hash01(seed + 7, x, y, z);
        let ch = 'L';
        if (r < 0.2) ch = 'D';
        else if (r > 0.78) ch = 'H';
        g.set(x, y, z, ch);
      }
    }
  }
  if (!bloom) return;
  // flowers: cube-sized blooms on the exposed tops and fronts of the bush
  for (let y = 0; y < g.d; y++) {
    for (let x = 0; x < g.w; x++) {
      let top = -1;
      for (let z = 0; z < g.h; z++) if (g.get(x, y, z) !== '.') top = z;
      if (top >= 0 && hash01(seed + 11, x, y) > 0.55) g.set(x, y, top, bloom);
      for (let z = 0; z < top; z++) {
        if (g.get(x, y, z) !== '.' && g.get(x, y + 1, z) === '.' && hash01(seed + 13, x, y, z) > 0.8) g.set(x, y, z, bloom);
      }
    }
  }
}
