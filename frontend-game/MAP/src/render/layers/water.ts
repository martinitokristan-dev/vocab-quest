import { SEG_H } from '../../../data/world';
import { hash01 } from '../../core/rng';
import { CELL_D, CELL_W, GRID_COLS, MAT_WATER, sampleCell, type CellInfo } from '../../gen/carve';
import { k1Cell } from '../../gen/k1Terrain';
import { createSurface, ctxOf, type Surface } from '../../raster/canvas';
import type { View } from '../frame';

const K1_S1_INDEX = 20;
const TILE = 144;
const TILE_PX = 288;
const FRAMES = 4;
const FALL_W = 18;
const FALL_H = 64;

export type WaterRect = readonly [x: number, y: number, w: number, h: number];

/**
 * Cube-aligned water rectangles of one segment, in world units, matching the cells the bake paints
 * (runs of water cells in a row, merged vertically when they line up).
 */
export function computeWaterRects(index: number): WaterRect[] {
  const top = index * SEG_H;
  const isK1S1 = index === K1_S1_INDEX;
  const g0 = Math.floor(top / CELL_D);
  const g1 = Math.ceil((top + SEG_H) / CELL_D) - 1;
  const cell: CellInfo = { h: 0, m: 0 };
  const out: Array<[number, number, number, number]> = [];
  let prev: Array<[number, number, number, number]> = [];
  for (let gj = g0; gj <= g1; gj++) {
    const baseY = gj * CELL_D + (isK1S1 ? 0 : 5);
    const row: Array<[number, number, number, number]> = [];
    let start = -1;
    for (let gi = 0; gi <= GRID_COLS; gi++) {
      let water = false;
      if (gi < GRID_COLS) {
        if (!(isK1S1 && k1Cell(gi, gj, cell))) sampleCell(gi, gj, cell);
        water = cell.m === MAT_WATER;
      }
      if (water && start < 0) start = gi;
      else if (!water && start >= 0) {
        const x = start * CELL_W;
        const w = (gi - start) * CELL_W;
        const above = prev.find((r) => r[0] === x && r[2] === w && Math.abs(r[1] + r[3] - baseY) < 0.01);
        if (above) {
          above[3] += CELL_D;
          row.push(above);
        } else {
          const r: [number, number, number, number] = [x, baseY, w, CELL_D];
          out.push(r);
          row.push(r);
        }
        start = -1;
      }
    }
    prev = row;
  }
  return out;
}

function glintTile(frame: number): Surface {
  const s = createSurface(TILE_PX, TILE_PX);
  const ctx = ctxOf(s);
  const k = TILE_PX / TILE;
  ctx.scale(k, k);
  for (let i = 0; i < 34; i++) {
    const x = hash01(frame, i, 1) * (TILE - 20);
    const y = hash01(frame, i, 2) * (TILE - 8);
    const w = 6 + Math.floor(hash01(frame, i, 3) * 3) * 4;
    const h = 2 + Math.floor(hash01(frame, i, 4) * 2) * 2;
    ctx.fillStyle = hash01(frame, i, 5) < 0.5 ? 'rgba(255,255,255,0.55)' : 'rgba(190,230,255,0.5)';
    ctx.fillRect(x, y, w, h);
  }
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = 'rgba(20,70,150,0.16)';
    ctx.fillRect(hash01(frame, i, 6) * (TILE - 24), hash01(frame, i, 7) * (TILE - 4), 14 + hash01(frame, i, 8) * 10, 2);
  }
  return s;
}

function fallTile(): Surface {
  const s = createSurface(FALL_W * 2, FALL_H * 2);
  const ctx = ctxOf(s);
  ctx.scale(2, 2);
  const bands: Array<[number, string]> = [
    [0, 'rgba(255,255,255,0.55)'],
    [14, 'rgba(160,215,250,0.45)'],
    [30, 'rgba(47,128,216,0.35)'],
    [46, 'rgba(235,248,255,0.5)'],
  ];
  for (let x = 0; x < FALL_W; x += 6) {
    for (const [y, c] of bands) {
      ctx.fillStyle = c;
      ctx.fillRect(x, (y + x * 3) % FALL_H, 4, 12);
    }
  }
  return s;
}

function puffTile(): Surface {
  const s = createSurface(64, 64);
  const ctx = ctxOf(s);
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return s;
}

/** Animated water shimmer and waterfalls (DESIGN 8). Reduced motion freezes the clock, so frames repeat exactly. */
export class WaterFx {
  private patterns: CanvasPattern[] = [];
  private fall: CanvasPattern | null = null;
  private puff: Surface | null = null;
  private tiles: Surface[] = [];
  private readonly paths = new Map<number, Path2D | null>();
  private readonly m = new DOMMatrix();

  private ensure(v: View): void {
    if (this.patterns.length) return;
    for (let f = 0; f < FRAMES; f++) {
      const t = glintTile(f);
      this.tiles.push(t);
      const p = v.ctx.createPattern(t as CanvasImageSource, 'repeat');
      if (p) this.patterns.push(p);
    }
    this.fall = v.ctx.createPattern(fallTile() as CanvasImageSource, 'repeat');
    this.puff = puffTile();
  }

  private pathFor(index: number): Path2D | null {
    let p = this.paths.get(index);
    if (p === undefined) {
      const rects = computeWaterRects(index);
      if (rects.length) {
        p = new Path2D();
        for (const r of rects) p.rect(r[0], r[1], r[2], r[3]);
      } else {
        p = null;
      }
      this.paths.set(index, p);
    }
    return p;
  }

  /** Shimmer over the water rects of the visible segments; call with the world transform set. */
  drawWater(v: View, first: number, last: number): void {
    this.ensure(v);
    if (!this.patterns.length) return;
    const t = v.time;
    const high = v.tier === 'high';
    const frame = v.tier === 'low' ? 0 : Math.floor(t * (high ? 6 : 3)) % FRAMES;
    const scroll = v.tier === 'low' ? 0 : t;
    const pat = this.patterns[frame];
    const k = TILE / TILE_PX;
    this.m.a = k;
    this.m.d = k;
    this.m.e = (scroll * 14) % TILE;
    this.m.f = (scroll * 6) % TILE;
    pat.setTransform(this.m);
    const ctx = v.ctx;
    ctx.fillStyle = pat;
    for (let s = first; s <= last; s++) {
      const p = this.pathFor(s);
      if (p) ctx.fill(p);
    }
  }

  /** Scrolling stripes and base mist over one waterfall sprite (x centre, y base, sprite size w x h). */
  drawFall(v: View, x: number, y: number, w: number, h: number, phase: number): void {
    this.ensure(v);
    if (!this.fall) return;
    const ctx = v.ctx;
    const t = v.tier === 'low' ? 0 : v.time;
    const k = 0.5;
    this.m.a = k;
    this.m.d = k;
    this.m.e = 0;
    this.m.f = (t * 140) % FALL_H;
    this.fall.setTransform(this.m);
    ctx.fillStyle = this.fall;
    ctx.fillRect(x - w / 2 + 2, y - h * 0.8, w - 4, h * 0.8 - h * 0.16);
    if (v.tier !== 'low' && this.puff) {
      ctx.globalAlpha = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(t * 2.2 + phase));
      for (let i = 0; i < 3; i++) {
        const dx = (i - 1) * (w * 0.32) + Math.sin(t * 0.9 + i * 2 + phase) * 4;
        const r = 14 + i * 2;
        ctx.drawImage(this.puff as CanvasImageSource, x + dx - r, y - r * 0.9 - 4 - i * 2, r * 2, r * 1.6);
      }
      ctx.globalAlpha = 1;
    }
  }

  destroy(): void {
    this.patterns = [];
    this.fall = null;
    this.puff = null;
    this.paths.clear();
    for (const t of this.tiles) {
      t.width = 0;
      t.height = 0;
    }
    this.tiles = [];
  }
}
