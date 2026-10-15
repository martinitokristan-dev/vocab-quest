import { MODELS } from '../../data/models';
import { KINGDOM_DECOR, SEGMENT_SPECS } from '../../data/scenes';
import type { DecorMix, SceneItem, SegmentSpec } from '../../data/scenes/types';
import { ENTRANCES, GATES } from '../../data/gates';
import { KINGDOMS, PATH_CLEAR, SEG_H, WORLD_W, kingdomBottomY } from '../../data/world';
import type { KingdomId } from '../api/types';
import { computeLayout } from '../core/layout';
import { hash, mulberry32 } from '../core/rng';
import { spriteSize } from '../raster/voxelRaster';
import { CELL_D, CELL_W, MAT_WATER, pathDistanceAt, sampleCell, type CellInfo } from './carve';
import { OBJ_FLAG, OBJ_SPRITE, type SceneObject } from './scatter';
import { isSkyAt, lowerEdge, type Boundary } from './zones';

/** Models that may stand on water. */
const WATER_OK = new Set(['bridge', 'bridge_long', 'k2_stone_bridge', 'k2_pier', 'k2_boat', 'reed', 'lily', 'waterfall']);
/** Minimum distance from a footprint to the route centre line (path half width 26 plus a margin). */
export const ROUTE_CLEAR = 42;
const STEP = 100;
const FENCE_STEP = 16;

/** x of the route at authoring height u (first crossing, interpolated). */
export function routeX(k: KingdomId, u: number): number {
  const pts = computeLayout().paths[k].pts;
  const y = kingdomBottomY(k) - u;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if ((a.y - y) * (b.y - y) <= 0) {
      const t = a.y === b.y ? 0 : (y - a.y) / (b.y - a.y);
      return a.x + (b.x - a.x) * t;
    }
  }
  return pts[pts.length - 1].x;
}

export interface Footprint {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Ground footprint of a sprite whose base centre is (x, y): width x model depth. */
export function spriteFootprint(m: string, x: number, y: number, f: number): Footprint {
  const model = MODELS[m];
  const [, d] = model.size;
  const u = model.unit ?? 1;
  const hw = (spriteSize(model).w * f) / 2;
  return { x0: x - hw, x1: x + hw, y0: y - d * 10 * u * f, y1: y };
}

/** Smallest route distance sampled on a footprint (corners, edge midpoints and a base row). */
export function footprintRouteDistance(fp: Footprint): number {
  let best = Infinity;
  const xs = [fp.x0, (fp.x0 * 3 + fp.x1) / 4, (fp.x0 + fp.x1) / 2, (fp.x0 + fp.x1 * 3) / 4, fp.x1];
  const ys = [fp.y0, (fp.y0 + fp.y1) / 2, fp.y1];
  for (const x of xs) for (const y of ys) best = Math.min(best, pathDistanceAt(x, y));
  return best;
}

function inReserved(x: number, y: number, pad: number): boolean {
  for (const e of ENTRANCES) {
    if (e.kingdom === 1) continue;
    if (x > e.hit.x - pad && x < e.hit.x + e.hit.w + pad && y > e.hit.y - pad && y < e.hit.y + e.hit.h + pad) return true;
  }
  for (const g of GATES) {
    if (x > g.archX - 200 && x < g.archX + 200 && y > g.archY - 40 && y < g.frontY + 60) return true;
  }
  return false;
}

function overlaps(fps: readonly Footprint[], x: number, y: number, pad: number): boolean {
  for (const f of fps) if (x > f.x0 - pad && x < f.x1 + pad && y > f.y0 - pad && y < f.y1 + pad) return true;
  return false;
}

function isWater(x: number, y: number, tmp: CellInfo): boolean {
  return sampleCell(Math.floor(x / CELL_W), Math.floor(y / CELL_D), tmp).m === MAT_WATER;
}

function pickWeighted(mix: DecorMix, r: number): readonly [string, number, number?] {
  let total = 0;
  for (const e of mix) total += e[1];
  let t = r * total;
  for (const e of mix) {
    t -= e[1];
    if (t <= 0) return e;
  }
  return mix[mix.length - 1];
}

/** Sprites of one item after route-relative placement and the push-out; null when it cannot be placed. */
function placeItem(k: KingdomId, it: SceneItem, tmp: CellInfo): { obj: SceneObject; fp: Footprint } | null {
  const model = MODELS[it.m];
  if (!model) throw new Error(`unknown model ${it.m}`);
  const f = it.f ?? 1;
  const y = kingdomBottomY(k) - it.u;
  const rx = routeX(k, it.u);
  let x = it.x ?? rx + (it.off ?? 0);
  const half = (spriteSize(model).w * f) / 2;
  x = Math.min(WORLD_W - half - 4, Math.max(half + 4, x));
  if (!it.fixed) {
    const dir = x >= rx ? 1 : -1;
    for (let i = 0; i < 16 && footprintRouteDistance(spriteFootprint(it.m, x, y, f)) < ROUTE_CLEAR; i++) x += dir * 20;
    if (footprintRouteDistance(spriteFootprint(it.m, x, y, f)) < ROUTE_CLEAR) return null;
    if (x < half || x > WORLD_W - half) return null;
  }
  if (isSkyAt(x, y)) return null;
  if (!WATER_OK.has(it.m) && !it.fixed && isWater(x, y, tmp)) return null;
  return { obj: { t: OBJ_SPRITE, m: it.m, f, x, y, variant: 0, phase: 0 }, fp: spriteFootprint(it.m, x, y, f) };
}

/** Horizon hills of boundary b along the lower kingdom's land edge: pyramids, mesas or conical peaks. */
function horizon(b: Boundary): SceneObject[] {
  const out: SceneObject[] = [];
  const rng = mulberry32(hash(7700 + b, 3));
  const a = b === 1 ? 'hill_a' : b === 2 ? 'mesa_a' : 'peak_a';
  const c = b === 1 ? 'hill_b' : b === 2 ? 'mesa_b' : 'peak_b';
  const gate = GATES.find((g) => g.kingdom === b);
  const rows: ReadonlyArray<readonly [number, number, number]> = [
    [86, 10, b === 3 ? 0.62 : 0.5],
    [134, 38, b === 3 ? 0.85 : 0.68],
  ];
  for (const [spacing, drop, f] of rows) {
    for (let x = spacing * 0.4; x < WORLD_W; x += spacing) {
      const jx = x + (rng() - 0.5) * spacing * 0.6;
      const pick = rng();
      const sc = f * (0.85 + rng() * 0.3);
      if (gate && Math.abs(jx - gate.archX) < 190) continue;
      const gi = Math.floor(jx / CELL_W);
      out.push({ t: OBJ_SPRITE, m: pick < 0.5 ? a : c, f: sc, x: jx, y: lowerEdge(b, gi) + drop, variant: 0, phase: 0 });
    }
  }
  return out;
}

/**
 * Distant stepped hills along the far left / right margins of a segment (pyramids, mesas or peaks by kingdom),
 * so the sides read like the reference's hill silhouettes. Only placed on dry land away from the route.
 */
function edgeHills(k: KingdomId, n: number, top: number, tmp: CellInfo): SceneObject[] {
  const out: SceneObject[] = [];
  const rng = mulberry32(hash(7800 + k, n, 5));
  const a = k === 1 ? 'hill_a' : k === 2 ? 'mesa_a' : 'peak_a';
  const c = k === 1 ? 'hill_b' : k === 2 ? 'mesa_b' : 'peak_b';
  for (let y = top + 120; y < top + SEG_H; y += 260) {
    for (const side of [0, 1]) {
      const jy = y + (rng() - 0.5) * 80;
      const x = side === 0 ? 40 + rng() * 120 : WORLD_W - 40 - rng() * 120;
      const f = 0.55 + rng() * 0.3;
      const m = rng() < 0.5 ? a : c;
      if (isSkyAt(x, jy) || isWater(x, jy, tmp) || inReserved(x, jy, 30)) continue;
      if (footprintRouteDistance(spriteFootprint(m, x, jy, f)) < ROUTE_CLEAR) continue;
      out.push({ t: OBJ_SPRITE, m, f, x, y: jy, variant: 0, phase: 0 });
    }
  }
  return out;
}

const specCache = new Map<string, SegmentSpec | undefined>();
function specFor(k: KingdomId, n: number): SegmentSpec | undefined {
  const key = `${k}:${n}`;
  if (!specCache.has(key)) specCache.set(key, SEGMENT_SPECS[k].find((s) => s.n === n));
  return specCache.get(key);
}

/**
 * Scene of one procedural segment (K1 S2-S7, K2, K3): authored items first, then fences, flags, the
 * seam horizon and a themed scatter that avoids the route, water, sky, the items and the reserved
 * entrance / gate areas. Deterministic; objects are sorted by depth and belong to this segment's y range.
 */
export function buildKingdomSegment(k: KingdomId, n: number, top: number): SceneObject[] {
  const spec = specFor(k, n);
  const bottom = kingdomBottomY(k);
  const tmp: CellInfo = { h: 0, m: 0 };
  const out: SceneObject[] = [];
  const fps: Footprint[] = [];
  if (spec) {
    for (const it of spec.items) {
      const p = placeItem(k, it, tmp);
      if (!p) continue;
      out.push(p.obj);
      fps.push(p.fp);
    }
    for (const line of spec.fences ?? []) {
      for (let i = 1; i < line.length; i++) {
        const ax = routeX(k, line[i - 1][1]) + line[i - 1][0];
        const ay = bottom - line[i - 1][1];
        const bx = routeX(k, line[i][1]) + line[i][0];
        const by = bottom - line[i][1];
        const cnt = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / FENCE_STEP));
        for (let q = 0; q <= cnt; q++) {
          const x = ax + ((bx - ax) * q) / cnt;
          const y = ay + ((by - ay) * q) / cnt;
          if (pathDistanceAt(x, y) < ROUTE_CLEAR || isSkyAt(x, y) || isWater(x, y, tmp)) continue;
          out.push({ t: OBJ_SPRITE, m: 'fence', f: 1, x, y, variant: 0, phase: 0 });
        }
      }
    }
    for (const fl of spec.flags ?? []) {
      const y = bottom - fl.u;
      out.push({ t: OBJ_FLAG, m: fl.kind, x: fl.x + fl.w / 2 + 2, y, w: fl.w, h: fl.h, ky: y + 400, variant: 0, phase: fl.x });
    }
  }
  if (n === 7) for (const o of horizon(k as Boundary)) out.push(o);
  for (const o of edgeHills(k, n, top, tmp)) out.push(o);

  const mix = spec?.decor ?? KINGDOM_DECOR[k];
  const density = spec?.density ?? 0.5;
  const rng = mulberry32(hash(KINGDOMS[k - 1].seed, n, 9));
  for (let gy = 0; gy * STEP < SEG_H; gy++) {
    for (let gx = 0; gx * STEP < WORLD_W; gx++) {
      const jx = rng();
      const jy = rng();
      const pick = rng();
      const pick2 = rng();
      const jf = rng();
      const x = gx * STEP + 10 + jx * (STEP - 20);
      const y = top + gy * STEP + 10 + jy * (STEP - 20);
      if (pick > density || y >= top + SEG_H) continue;
      if (isSkyAt(x, y) || pathDistanceAt(x, y) <= PATH_CLEAR || inReserved(x, y, 30) || overlaps(fps, x, y, 14)) continue;
      if (isWater(x, y, tmp)) {
        if (k === 1 && pick2 < 0.4) out.push({ t: OBJ_SPRITE, m: 'lily', f: 1.2, x, y, ky: y - 300, variant: 0, phase: 0 });
        else if (k === 2 && pick2 < 0.3) out.push({ t: OBJ_SPRITE, m: 'reed', f: 1, x, y, variant: 0, phase: 0 });
        continue;
      }
      const [m, , scale] = pickWeighted(mix, pick2);
      const f = (scale ?? 1) * (0.9 + jf * 0.2);
      if (footprintRouteDistance(spriteFootprint(m, x, y, f)) < ROUTE_CLEAR) continue;
      out.push({ t: OBJ_SPRITE, m, f, x, y, variant: 0, phase: 0 });
    }
  }
  const lo = top;
  const hi = top + SEG_H;
  return out.filter((o) => o.y >= lo && o.y < hi).sort((p, q) => (p.ky ?? p.y) - (q.ky ?? q.y));
}
