import { K1_FLAGS, K1_LANDMARKS } from '../../data/scenes/k1';
import { landmarkPlacement } from '../gen/k1Scene';
import { ctxOf, type Surface } from '../raster/canvas';
import type { Sprites } from './sprites';

export interface Box {
  readonly id: string;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Tight opaque bounds of a surface in bitmap px (alpha > 24), or null when empty. */
export function opaqueBounds(s: Surface): { x0: number; y0: number; x1: number; y1: number } | null {
  const w = s.width;
  const h = s.height;
  const d = ctxOf(s).getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

/**
 * Rendered boxes (reference px) measured from the actual sprite pixels: one per landmark, plus flags.
 * Used by the demo compare tool (tools/compare.mjs) against tools/reference-boxes.json.
 */
export function measureLandmarkBoxes(sprites: Sprites, scale: number): Box[] {
  const out: Box[] = [];
  for (const lm of K1_LANDMARKS) {
    const f = lm.f ?? 1;
    const p = landmarkPlacement(lm.m, lm.at, f);
    const b = opaqueBounds(sprites.sprite(lm.m, 1));
    if (!b) continue;
    const k = f / scale;
    out.push({ id: lm.id, x0: p.x + b.x0 * k, y0: p.y + b.y0 * k, x1: p.x + b.x1 * k, y1: p.y + b.y1 * k });
  }
  K1_FLAGS.forEach((fl, i) => out.push({ id: `flag${i}`, x0: fl.x, y0: fl.y, x1: fl.x + fl.w, y1: fl.y + fl.h }));
  return out;
}
