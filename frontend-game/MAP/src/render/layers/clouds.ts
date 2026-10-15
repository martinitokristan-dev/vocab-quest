import { GATES } from '../../../data/gates';
import { hash01 } from '../../core/rng';
import { arrivalX, boundaryY, type Boundary } from '../../gen/zones';
import { createSurface, ctxOf, type Ctx2D, type Surface } from '../../raster/canvas';

/**
 * Block clouds of the sky seams (DESIGN 6.4). A cloud is an ellipsoid of 18 x 10 x 14 cubes, so it shares
 * the cube size and lighting of the terrain. `kind` 'step' marks the cloud stairs that climb to the next
 * kingdom's entrance island.
 */
export interface Cloud {
  readonly kind: 'big' | 'small' | 'step';
  /** World x / y of the footprint's top-left (top face of the lowest course, first row). */
  readonly x: number;
  readonly y: number;
  readonly cols: number;
  readonly rows: number;
  readonly levels: number;
  readonly seed: number;
}

const CW = 18;
const CD = 10;
const CH = 14;

/** [x, dy (from the boundary), cols] of the large clouds; dy < 0 is the next kingdom's side. */
const BIG_SOUTH: ReadonlyArray<readonly [number, number, number]> = [
  [30, 160, 12], [300, 30, 9], [470, 215, 14], [820, 70, 10], [1100, 190, 13], [1340, 20, 11], [1530, 210, 10], [1650, 95, 8], [110, 15, 8],
];
const BIG_NORTH: ReadonlyArray<readonly [number, number, number]> = [
  [60, -215, 11], [900, -170, 12], [1250, -235, 10], [1430, -110, 13], [1610, -190, 9], [80, -95, 9], [760, -240, 8],
];
const BIG_TOP: ReadonlyArray<readonly [number, number, number]> = [
  [80, 120, 10], [420, 40, 9], [900, 150, 12], [1200, 60, 10], [1560, 170, 9], [20, 215, 8],
];
const SMALL: ReadonlyArray<readonly [number, number, number]> = [
  [230, 120, 5], [620, 120, 6], [1010, 255, 5], [1260, 100, 4], [1700, 40, 5], [700, -120, 5], [1100, -60, 6], [1700, -50, 4],
];

const fieldCache = new Map<Boundary, Cloud[]>();

/**
 * Deterministic cloud field of boundary k (1 = K1/K2 seam, 2 = K2/K3 seam, 3 = top of the world), sorted by
 * y for painter order. Contains >= 6 large clouds inside the lower kingdom's sky gate zone and, for the
 * two inner seams, six cloud stairs from the gate toward the next kingdom's entrance.
 */
export function cloudField(k: Boundary): Cloud[] {
  const hit = fieldCache.get(k);
  if (hit) return hit;
  const Y = boundaryY(k);
  const out: Cloud[] = [];
  const add = (kind: Cloud['kind'], x: number, dy: number, cols: number, seed: number): void => {
    out.push({ kind, x, y: Y + dy, cols, rows: kind === 'big' ? 4 : 3, levels: kind === 'big' ? 3 : 2, seed });
  };
  const big = k === 3 ? BIG_TOP : BIG_SOUTH.concat(BIG_NORTH);
  big.forEach(([x, dy, cols], i) => add('big', x, dy, cols, k * 100 + i));
  SMALL.forEach(([x, dy, cols], i) => {
    if (k !== 3 || dy > 0) add('small', x, dy, cols, k * 100 + 50 + i);
  });
  if (k !== 3) {
    const gate = GATES.find((g) => g.kingdom === k);
    const ax = arrivalX(k);
    if (gate && ax !== undefined) {
      const sx = gate.archX - 54;
      const ex = ax - 54;
      const STEPS = 6;
      for (let i = 0; i < STEPS; i++) {
        const t = i / (STEPS - 1);
        add('step', Math.round(sx + (ex - sx) * t), Math.round(130 + (-8 - 130) * t), 6, k * 100 + 80 + i);
      }
    }
  }
  out.sort((a, b) => (a.kind === 'step' ? 1 : 0) - (b.kind === 'step' ? 1 : 0) || a.y - b.y);
  fieldCache.set(k, out);
  return out;
}

/** Vertical extent [top, bottom] of a cloud in world y. */
export function cloudExtent(c: Cloud): [number, number] {
  return [c.y - (c.levels - 1) * CH, c.y + c.rows * CD + CH];
}

function included(c: Cloud, q: number, r: number, z: number): boolean {
  const a = (q + 0.5 - c.cols / 2) / (c.cols / 2);
  const b = (r + 0.5 - c.rows / 2) / (c.rows / 2);
  const s = 1 - z * 0.24;
  return a * a + b * b <= s * s * (1 + (hash01(c.seed, q, r, z) - 0.5) * 0.4);
}

const TOP = [255, 255, 255];
const FRONT = [214, 228, 244];

function tone(base: number[], f: number): string {
  return `rgb(${Math.min(255, Math.round(base[0] * f))},${Math.min(255, Math.round(base[1] * f))},${Math.min(255, Math.round(base[2] * f))})`;
}

/** A near-layer cloud that drifts in x (6 to 14 units per second) inside a sky seam. */
export interface DriftCloud {
  readonly cloud: Cloud;
  readonly speed: number;
  /** Starting x offset along the wrap range. */
  readonly offset: number;
}

const DRIFT_MARGIN = 260;
const DRIFT_WRAP = 1774 + DRIFT_MARGIN * 2;
let driftCache: DriftCloud[] | null = null;

/** Deterministic drifting clouds, 8 per seam (the renderer draws 8, 5 or 2 by quality tier), sorted by seam. */
export function driftClouds(): DriftCloud[] {
  if (driftCache) return driftCache;
  const out: DriftCloud[] = [];
  for (const b of [1, 2, 3] as const) {
    const Y = boundaryY(b);
    for (let i = 0; i < 8; i++) {
      const r = (n: number): number => hash01(b * 31 + i, n, 77);
      const cols = 6 + Math.floor(r(1) * 7);
      const dy = (b === 3 ? 20 : -40) + r(2) * (b === 3 ? 260 : 320);
      out.push({
        cloud: { kind: i % 3 === 0 ? 'big' : 'small', x: 0, y: Y + dy, cols, rows: i % 3 === 0 ? 4 : 3, levels: i % 3 === 0 ? 3 : 2, seed: 900 + b * 10 + i },
        speed: 6 + r(3) * 8,
        offset: r(4) * DRIFT_WRAP,
      });
    }
  }
  driftCache = out;
  return out;
}

/** World x of the left edge of a drifting cloud at world time t. */
export function driftX(d: DriftCloud, t: number): number {
  return ((d.offset + t * d.speed) % DRIFT_WRAP) - DRIFT_MARGIN;
}

/** Size in world units of the sprite of a cloud (cube grid plus the stacked levels). */
export function cloudSpriteSize(c: Cloud): { w: number; h: number } {
  return { w: c.cols * CW + 2, h: (c.levels - 1) * CH + c.rows * CD + CH + 2 };
}

/** Rasterises one cloud into a surface at `scale` bitmap pixels per world unit. */
export function rasterCloud(c: Cloud, scale: number): Surface {
  const size = cloudSpriteSize(c);
  const s = createSurface(size.w * scale, size.h * scale);
  const ctx = ctxOf(s);
  ctx.scale(scale, scale);
  drawClouds(ctx, [{ ...c, x: 0, y: (c.levels - 1) * CH }], -1e9, 1e9);
  return s;
}

/** Paints the clouds that intersect [top, bottom] (world y), back to front, cube by cube. */
export function drawClouds(ctx: Ctx2D, clouds: readonly Cloud[], top: number, bottom: number): void {
  for (const c of clouds) {
    const [t, b] = cloudExtent(c);
    if (b < top - 64 || t > bottom + 64) continue;
    for (let r = 0; r < c.rows; r++) {
      for (let z = 0; z < c.levels; z++) {
        for (let q = 0; q < c.cols; q++) {
          if (!included(c, q, r, z)) continue;
          const n = 1 + (hash01(c.seed + 9, q, r, z) - 0.5) * 0.05;
          const x = c.x + q * CW;
          const y = c.y + r * CD - z * CH;
          ctx.fillStyle = tone(TOP, n);
          ctx.fillRect(x, y, CW, CD);
          ctx.fillStyle = tone(FRONT, n);
          ctx.fillRect(x, y + CD, CW, CH);
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.fillRect(x, y + CD, 2, CH);
          ctx.fillStyle = 'rgba(90,120,170,0.22)';
          ctx.fillRect(x + CW - 2, y + CD, 2, CH);
          ctx.strokeStyle = 'rgba(120,150,195,0.28)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, CW - 1, CD + CH - 1);
        }
      }
    }
  }
}
