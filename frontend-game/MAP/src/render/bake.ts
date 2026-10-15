import { SEG_H, WORLD_W } from '../../data/world';
import type { KingdomId } from '../api/types';
import { hash01 } from '../core/rng';
import {
  CELL_D,
  CELL_W,
  GRID_COLS,
  MAT_DIRT,
  MAT_PATH,
  MAT_PLANK,
  MAT_SKY,
  MAT_STONE,
  MAT_WATER,
  pathDistanceAt,
  sampleCell,
  type CellInfo,
} from '../gen/carve';
import { farfieldRows, levelAt } from '../gen/heightfield';
import { K1_PATH_HALF_W, K1_ROW0, k1Cell } from '../gen/k1Terrain';
import { K1_TERRAIN } from '../../data/scenes/k1-terrain';
import { segmentInfo } from '../gen/segmentScene';
import { BOUNDARIES, ISLAND_DROP, SKY_BAND, boundaryY, isSkyCell, type Boundary } from '../gen/zones';
import { createSurface, ctxOf, type Ctx2D, type Surface } from '../raster/canvas';
import { PALETTES, WATER_TONES, mixHex, shade, toneTable } from '../raster/materials';
import { cloudField, drawClouds } from './layers/clouds';

const CELL_H = 14;
const TONES = 8;
/** K1 S1 (global index 20) holds the reference perspective band. */
export const K1_S1 = 20;
export const K1_S1_REF_Y0 = 17740;
const FAR_BOTTOM = 450;

interface Tones {
  grassTop: string[];
  grassFront: string[];
  dirtTop: string[];
  dirtFront: string[];
  stoneTop: string[];
  stoneFront: string[];
  cobbleTop: string[];
  cobbleFront: string[];
  plankTop: string[];
  plankFront: string[];
  hl: string; // left highlight
  sh: string; // right shadow
}

const toneCache = new Map<KingdomId, Tones>();


function tonesFor(k: KingdomId): Tones {
  let t = toneCache.get(k);
  if (!t) {
    const p = PALETTES[k];
    t = {
      grassTop: toneTable(p.grassTop, TONES, 0.06, 1.0),
      grassFront: toneTable(p.grassFront, TONES, 0.05),
      dirtTop: toneTable(p.dirtTop, TONES, 0.05),
      dirtFront: toneTable(p.dirtFront, TONES, 0.05),
      stoneTop: toneTable(p.stoneTop, TONES, 0.07),
      stoneFront: toneTable(p.stoneFront, TONES, 0.06),
      cobbleTop: toneTable('#e6c16a', TONES, 0.05),
      cobbleFront: toneTable('#b8964a', TONES, 0.05),
      plankTop: toneTable('#a8723a', TONES, 0.07),
      plankFront: toneTable('#7a4e26', TONES, 0.06),
      hl: 'rgba(255,255,255,0.12)',
      sh: 'rgba(0,0,0,0.16)',
    };
    toneCache.set(k, t);
  }
  return t;
}

/** World y range of the sky gradient of boundary b (the land edges overdraw its margins). */
function skyBand(b: Boundary): [number, number] {
  const Y = boundaryY(b);
  return [b === 3 ? Y : Y - ISLAND_DROP - 40, Y + SKY_BAND + 12];
}

/** Paints boundary b's sky gradient and block clouds into the segment whose top is `top`. */
function paintSeam(ctx: Ctx2D, top: number, b: Boundary): void {
  const [y0, y1] = skyBand(b);
  if (y1 < top || y0 > top + SEG_H) return;
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  const lo = PALETTES[b];
  if (b === 3) {
    g.addColorStop(0, lo.skyTop);
    g.addColorStop(1, lo.skyBottom);
  } else {
    const up = PALETTES[(b + 1) as KingdomId];
    g.addColorStop(0, up.skyBottom);
    g.addColorStop(0.5, mixHex(up.skyTop, lo.skyTop, 0.5));
    g.addColorStop(1, lo.skyBottom);
  }
  ctx.fillStyle = g;
  const a = Math.max(y0, top - 1);
  ctx.fillRect(0, a, WORLD_W, Math.min(y1, top + SEG_H + 1) - a);
  drawClouds(ctx, cloudField(b), top, top + SEG_H);
}

/** Row-sliced segment bake: call step(budgetMs) until it returns true. */
export class SegmentBake {
  readonly surface: Surface;
  readonly index: number;
  readonly scale: number;
  private readonly ctx: Ctx2D;
  private readonly kingdom: KingdomId;
  private readonly top: number;
  private readonly tones: Tones;
  private readonly cell: CellInfo = { h: 0, m: 0 };
  private readonly cell2: CellInfo = { h: 0, m: 0 };
  private waterDone: boolean;
  private gj: number;
  private readonly gjEnd: number;
  private farDone: boolean;

  constructor(index: number, scale: number) {
    this.index = index;
    this.scale = scale;
    this.top = index * SEG_H;
    this.kingdom = segmentInfo(index).kingdom;
    this.tones = tonesFor(this.kingdom);
    this.surface = createSurface(WORLD_W * scale, SEG_H * scale);
    this.ctx = ctxOf(this.surface);
    this.ctx.setTransform(scale, 0, 0, scale, 0, -this.top * scale);
    // Cells whose column spills into the segment: rows from one above the top to the bottom + max column height.
    this.gj = Math.floor(this.top / CELL_D) - 1;
    this.gjEnd = Math.ceil((this.top + SEG_H + 4 * CELL_H) / CELL_D);
    this.farDone = index !== K1_S1;
    this.waterDone = index !== K1_S1;
    this.ctx.fillStyle = PALETTES[this.kingdom].grassFront;
    this.ctx.fillRect(0, this.top, WORLD_W, SEG_H);
    for (const b of BOUNDARIES) paintSeam(this.ctx, this.top, b);
  }

  /** Runs for about budgetMs; returns true when the bake is complete. */
  step(budgetMs: number): boolean {
    const start = performance.now();
    if (!this.farDone) {
      this.drawFarfield();
      this.farDone = true;
    }
    while (this.gj <= this.gjEnd) {
      this.drawRow(this.gj++);
      if (performance.now() - start >= budgetMs) break;
    }
    if (this.gj > this.gjEnd && !this.waterDone) {
      this.drawWater();
      this.waterDone = true;
    }
    return this.gj > this.gjEnd;
  }

  /** K1 S1 only: measured water cells painted after the land, so they stay visible where terraces overlap. */
  private drawWater(): void {
    const ctx = this.ctx;
    const rows = K1_TERRAIN.length;
    for (let rj = 0; rj < rows; rj++) {
      const baseY = (K1_ROW0 + rj) * CELL_D;
      for (let gi = 0; gi < GRID_COLS; gi++) {
        const c = this.cell;
        if (!k1Cell(gi, K1_ROW0 + rj, c) || c.m !== MAT_WATER) continue;
        const x = gi * CELL_W;
        const n = (gi * 7 + rj * 3 + ((gi * rj) % 5)) % 3;
        ctx.fillStyle = WATER_TONES[n];
        ctx.fillRect(x, baseY, CELL_W + 0.5, CELL_D + 0.5);
        ctx.fillStyle = 'rgba(210,235,255,0.55)';
        ctx.fillRect(x, baseY, CELL_W, 1);
        ctx.fillRect(x, baseY, 1, CELL_D);
        const north = k1Cell(gi, K1_ROW0 + rj - 1, this.cell2) && this.cell2.m === MAT_WATER;
        if (!north) {
          ctx.fillStyle = 'rgba(10,50,110,0.35)';
          ctx.fillRect(x, baseY, CELL_W, 3);
        }
      }
    }
  }

  private drawFarfield(): void {
    const ctx = this.ctx;
    const t = this.tones;
    for (const row of farfieldRows(0, FAR_BOTTOM)) {
      const wy = K1_S1_REF_Y0 + row.y0 + row.depth; // baseline (bottom edge) of the row
      for (let c = 0; c < row.columns; c++) {
        const x = c * row.w;
        // K1 S1 far field: grass terraces (0..2) with a few grey cubes, matching the reference's tree-covered ground
        const h = Math.min(2, levelAt((x + row.w / 2) / CELL_W, (wy - row.depth / 2) / CELL_D));
        const n = Math.floor(hash01(c, Math.floor(row.y0 * 4), 91) * TONES);
        const stone = hash01(c, Math.floor(row.y0 * 4), 92) < 0.035;
        const hh = h * CELL_H * row.s;
        const top = wy - row.depth - hh;
        if (h > 0) {
          ctx.fillStyle = stone ? t.stoneFront[n] : t.grassFront[n];
          ctx.fillRect(x, top + row.depth, row.w + 0.5, hh);
        }
        ctx.fillStyle = stone ? t.stoneTop[n] : t.grassTop[n];
        ctx.fillRect(x, top, row.w + 0.5, row.depth + 0.5);
      }
    }
  }

  private drawRow(gj: number): void {
    if (gj < 0) return;
    const ctx = this.ctx;
    const t = this.tones;
    const baseY = gj * CELL_D;
    const farLimit = K1_S1_REF_Y0 + FAR_BOTTOM; // rows above this are the far field on K1 S1
    const isK1S1 = this.index === K1_S1;
    const cell = this.cell;
    for (let gi = 0; gi < GRID_COLS; gi++) {
      if (isK1S1 && baseY < farLimit && pathDistanceAt(gi * CELL_W + 9, baseY + 5) > K1_PATH_HALF_W + 18) continue;
      if (!(isK1S1 && k1Cell(gi, gj, cell))) sampleCell(gi, gj, cell);
      if (cell.m === MAT_SKY) continue; // the seam sky was painted up front
      if (isK1S1 && cell.m === MAT_WATER) continue; // painted in the water pass
      // the K1 route beyond the reference curl is a wooden boardwalk (DESIGN 3.4)
      if (this.kingdom === 1 && !isK1S1 && cell.m === MAT_PATH) cell.m = MAT_PLANK;
      const x = gi * CELL_W;
      const n = Math.floor(hash01(gi, gj, 5) * TONES);
      if (cell.m === MAT_WATER) {
        ctx.fillStyle = WATER_TONES[(gi + gj) % 3];
        ctx.fillRect(x, baseY + 5, CELL_W, CELL_D + 0.5);
        ctx.fillStyle = shade('#ffffff', 0.9);
        if (((gi * 3 + gj * 5) & 7) === 0) ctx.fillRect(x + 4, baseY + 8, 8, 2);
        continue;
      }
      const h = cell.h;
      const topY = baseY - h * CELL_H;
      let topC: string;
      let frontC: string;
      if (cell.m === MAT_PATH) {
        topC = t.cobbleTop[n];
        frontC = t.cobbleFront[n];
      } else if (cell.m === MAT_PLANK) {
        topC = t.plankTop[n];
        frontC = t.plankFront[n];
      } else if (cell.m === MAT_STONE) {
        topC = t.stoneTop[n];
        frontC = t.stoneFront[n];
      } else if (cell.m === MAT_DIRT) {
        topC = t.dirtTop[n];
        frontC = t.dirtFront[n];
      } else {
        topC = t.grassTop[n];
        frontC = t.grassFront[n];
      }
      if (h > 0) {
        ctx.fillStyle = frontC;
        ctx.fillRect(x, topY + CELL_D, CELL_W, h * CELL_H);
        ctx.fillStyle = t.hl;
        ctx.fillRect(x, topY + CELL_D, 2, h * CELL_H);
        ctx.fillStyle = t.sh;
        ctx.fillRect(x + CELL_W - 2, topY + CELL_D, 2, h * CELL_H);
      }
      ctx.fillStyle = topC;
      ctx.fillRect(x, topY, CELL_W, CELL_D);
      if (cell.m === MAT_PATH) {
        // golden brick courses: a mortar line under each row and a staggered vertical joint
        ctx.fillStyle = 'rgba(140,100,40,0.38)';
        ctx.fillRect(x, topY + CELL_D - 1, CELL_W, 1);
        ctx.fillRect(x + ((gj & 1) === 0 ? 0 : CELL_W / 2), topY, 1, CELL_D - 1);
        ctx.fillStyle = 'rgba(255,240,180,0.28)';
        ctx.fillRect(x + 1, topY, CELL_W - 1, 1);
      }
      if (!isK1S1 && isSkyCell(gi, gj + 1)) this.drawCliff(x, baseY, gi, gj, n);
    }
  }

  /** Underside of a floating island: two or three courses of dirt and stone below a land cell facing the sky. */
  private drawCliff(x: number, baseY: number, gi: number, gj: number, n: number): void {
    const ctx = this.ctx;
    const t = this.tones;
    const courses = 2 + Math.floor(hash01(gi, gj, 41) * 2);
    const y0 = baseY + CELL_D;
    for (let c = 0; c < courses; c++) {
      const y = y0 + c * CELL_H;
      ctx.fillStyle = c === 0 ? t.dirtFront[n] : t.stoneFront[n];
      ctx.fillRect(x, y, CELL_W, CELL_H);
      ctx.fillStyle = t.hl;
      ctx.fillRect(x, y, 2, CELL_H);
      ctx.fillStyle = t.sh;
      ctx.fillRect(x + CELL_W - 2, y, 2, CELL_H);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x, y + CELL_H - 1, CELL_W, 1);
    }
  }
}

/** Cheap 1/8 scale bake of cell colours (kept permanently for every segment). */
export function bakePlaceholder(index: number): Surface {
  const sc = 1 / 8;
  const s = createSurface(WORLD_W * sc, SEG_H * sc);
  const ctx = ctxOf(s);
  const top = index * SEG_H;
  ctx.setTransform(sc, 0, 0, sc, 0, -top * sc);
  const k = segmentInfo(index).kingdom;
  const p = PALETTES[k];
  ctx.fillStyle = p.grassFront;
  ctx.fillRect(0, top, WORLD_W, SEG_H);
  const cell: CellInfo = { h: 0, m: 0 };
  const g0 = Math.floor(top / CELL_D) - 1;
  const g1 = Math.ceil((top + SEG_H + 4 * CELL_H) / CELL_D);
  for (let gj = Math.max(0, g0); gj <= g1; gj++) {
    for (let gi = 0; gi < GRID_COLS; gi++) {
      sampleCell(gi, gj, cell);
      ctx.fillStyle = cell.m === MAT_SKY ? '#a4d8f4' : cell.m === MAT_WATER ? '#4aa0e8' : cell.m === MAT_PATH ? '#e8d5a0' : cell.m === MAT_STONE ? p.stoneTop : cell.m === MAT_DIRT ? p.dirtTop : p.grassTop;
      ctx.fillRect(gi * CELL_W, gj * CELL_D - Math.max(0, cell.h) * CELL_H, CELL_W, CELL_D + Math.max(0, cell.h) * CELL_H);
    }
  }
  return s;
}
