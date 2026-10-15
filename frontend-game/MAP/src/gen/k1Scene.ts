import { MODELS } from '../../data/models';
import { modelBounds } from '../../data/models/build';
import { K1_FENCES, K1_FLAGS, K1_GROVES, K1_HILL_ROWS, K1_ITEMS, K1_LANDMARKS, K1_S1_FOOTPRINTS } from '../../data/scenes/k1';
import { K1_S1_REF_Y0 } from '../../data/spines';
import { hash01, mulberry32 } from '../core/rng';
import { spriteSize } from '../raster/voxelRaster';
import { NODES } from '../../data/nodes';
import { CELL_D, CELL_W, pathDistanceAt } from './carve';
import { inPlaza, k1Class } from './k1Terrain';
import { OBJ_FLAG, OBJ_SPRITE, type SceneObject } from './scatter';

const FENCE_STEP = 16;
const BUSH_MIX = ['bush', 'bush_y', 'bush_o', 'bush_p', 'bush_w'];
const K1_S1_NODES = NODES.filter((n) => n.segment === 20);

function isLandDecor(m: string): boolean {
  return m.startsWith('oak') || m.startsWith('bush') || m.startsWith('rock');
}

/** True when the reference-px point sits on a measured water cell. */
function onWater(x: number, y: number): boolean {
  return k1Class(Math.floor(x / CELL_W), Math.floor(y / CELL_D)) === 'w';
}

/** Strictly enforces that trees, bushes, and decor stay far away from the road and every level node. */
function isClearOfRoadAndNodes(x: number, y: number, margin = 65): boolean {
  const worldY = K1_S1_REF_Y0 + y;
  if (pathDistanceAt(x, worldY) < margin) return false;
  for (const n of K1_S1_NODES) {
    if (Math.hypot(n.x - x, n.y - worldY) < margin + 15) return false;
  }
  return true;
}

/** Keeps groves off the route, nodes' path, the plazas and the landmark footprints. */
function blocked(x: number, y: number): boolean {
  if (!isClearOfRoadAndNodes(x, y, 65)) return true;
  if (inPlaza(x, y)) return true;
  for (const f of K1_S1_FOOTPRINTS) {
    if (f.bridge) continue;
    if (x >= f.x0 - 8 && x <= f.x1 + 8 && y >= f.y0 && y <= f.y1 + 18) return true;
  }
  return false;
}

/** World-space draw rect of a landmark: top-left of the sprite and its size, from the opaque bounds. */
export function landmarkPlacement(m: string, at: readonly [number, number], f = 1): { x: number; y: number; w: number; h: number } {
  const model = MODELS[m];
  const bb = modelBounds(model);
  const size = spriteSize(model);
  return { x: at[0] - bb.left * f, y: at[1] - bb.top * f, w: size.w * f, h: size.h * f };
}

let cache: SceneObject[] | null = null;

/** Hand-placed K1 S1 scene (DESIGN 14.0 step 3): landmarks, decor, fences, flags. Scatter is disabled here. */
export function buildK1S1Objects(): SceneObject[] {
  if (cache) return cache;
  const out: SceneObject[] = [];
  for (const lm of K1_LANDMARKS) {
    const p = landmarkPlacement(lm.m, lm.at, lm.f ?? 1);
    out.push({
      t: OBJ_SPRITE,
      m: lm.m,
      f: lm.f ?? 1,
      x: p.x + p.w / 2,
      y: K1_S1_REF_Y0 + p.y + p.h,
      ky: lm.sortY !== undefined ? K1_S1_REF_Y0 + lm.sortY : undefined,
      variant: 0,
      phase: 0,
    });
  }
  for (const [m, x, y, f] of K1_ITEMS) {
    if (isLandDecor(m) && (onWater(x, y) || !isClearOfRoadAndNodes(x, y, 65))) continue;
    const scale = (f ?? 1) * (m.startsWith('hill') ? 1.25 : 1);
    out.push({ t: OBJ_SPRITE, m, f: scale, x, y: K1_S1_REF_Y0 + y, variant: 0, phase: 0 });
  }
  // lily pads scattered over the river cells (deterministic from the authored water mask)
  for (let rj = 22; rj < 89; rj++) {
    for (let gi = 0; gi < 99; gi++) {
      if (k1Class(gi, rj) !== 'w' || hash01(gi, rj, 77) > 0.075) continue;
      const x = gi * CELL_W + 4 + hash01(gi, rj, 78) * 10;
      const y = rj * CELL_D + 8;
      if (blocked(x, y - 6)) continue;
      out.push({ t: OBJ_SPRITE, m: 'lily', f: 1.2, x, y: K1_S1_REF_Y0 + y, ky: K1_S1_REF_Y0 + y - 300, variant: 0, phase: 0 });
    }
  }
  for (const [y, f, count, seed] of K1_HILL_ROWS) {
    const rng = mulberry32(seed * 104729 + 7);
    const stepX = 1774 / count;
    for (let i = 0; i < count; i++) {
      const x = (i + 0.2 + rng() * 0.6) * stepX;
      const yy = y + (rng() - 0.5) * 12;
      if (blocked(x, yy - 20) || onWater(x, yy)) continue;
      out.push({ t: OBJ_SPRITE, m: rng() < 0.5 ? 'hill_a' : 'hill_b', f, x, y: K1_S1_REF_Y0 + yy, variant: 0, phase: 0 });
    }
  }
  for (const [x0, y0, x1, y1, count, seed] of K1_GROVES) {
    const rng = mulberry32(seed * 7919 + 13);
    for (let i = 0; i < count; i++) {
      const x = x0 + rng() * (x1 - x0);
      const y = y0 + rng() * (y1 - y0);
      const pick = rng();
      if (onWater(x, y) || blocked(x, y)) continue;
      const far = Math.min(1, Math.max(0, (y - 130) / 330));
      const f = 0.62 + 0.38 * far;
      let m: string;
      if (pick < 0.3) m = 'oak_s';
      else if (pick < 0.6) m = 'oak_m';
      else if (pick < 0.72) m = 'oak_l';
      else if (pick < 0.78) m = 'oak_xl';
      else m = BUSH_MIX[Math.floor((pick - 0.78) * 22.7) % BUSH_MIX.length];
      out.push({ t: OBJ_SPRITE, m, f: m.startsWith('bush') ? 1 : f, x, y: K1_S1_REF_Y0 + y, variant: 0, phase: 0 });
    }
  }
  for (const line of K1_FENCES) {
    for (let i = 1; i < line.length; i++) {
      const [ax, ay] = line[i - 1];
      const [bx, by] = line[i];
      const len = Math.hypot(bx - ax, by - ay);
      const n = Math.max(1, Math.round(len / FENCE_STEP));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        out.push({ t: OBJ_SPRITE, m: 'fence', f: 1, x: ax + (bx - ax) * t, y: K1_S1_REF_Y0 + ay + (by - ay) * t, variant: 0, phase: 0 });
      }
    }
  }
  for (const fl of K1_FLAGS) {
    out.push({
      t: OBJ_FLAG,
      m: fl.kind,
      x: fl.x + fl.w / 2,
      y: K1_S1_REF_Y0 + fl.y + fl.h,
      w: fl.w,
      h: fl.h,
      ky: K1_S1_REF_Y0 + 360,
      variant: 0,
      phase: fl.x,
    });
  }
  out.sort((a, b) => (a.ky ?? a.y) - (b.ky ?? b.y));
  cache = out;
  return out;
}
