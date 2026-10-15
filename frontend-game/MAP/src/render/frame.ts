import { SEG_H, SEGMENT_COUNT, WORLD_W } from '../../data/world';
import type { QualityTier } from '../core/quality';
import type { BakeQueue } from './bakeQueue';

export interface View {
  ctx: CanvasRenderingContext2D;
  /** Backing-store pixels per CSS px. */
  dpr: number;
  vw: number;
  vh: number;
  /** World rectangle currently visible. */
  left: number;
  top: number;
  right: number;
  bottom: number;
  zoom: number;
  /** World clock in seconds (frozen under reduced motion). */
  time: number;
  tier: QualityTier;
  /** prefers-reduced-motion in effect (static pulse outlines, frozen clock). */
  reduced?: boolean;
  /** Compare mode (demo only): no avatar, plain pink nodes 1..13. */
  plain?: boolean;
}

export function updateView(v: View, cx: number, cy: number, zoom: number): void {
  v.zoom = zoom;
  v.left = cx - v.vw / (2 * zoom);
  v.right = cx + v.vw / (2 * zoom);
  v.top = cy - v.vh / (2 * zoom);
  v.bottom = cy + v.vh / (2 * zoom);
}

/** Inclusive range of global segment indices intersecting [top, bottom]. */
export function visibleRange(top: number, bottom: number): [number, number] {
  const a = Math.max(0, Math.floor(top / SEG_H));
  const b = Math.min(SEGMENT_COUNT - 1, Math.floor(bottom / SEG_H));
  return [a, Math.max(a, b)];
}

/**
 * Blits the visible baked segments (placeholder when not baked yet) at integer device-pixel positions.
 * Every edge uses the same rounding formula and each blit is extended by one device pixel, so neighbouring
 * segments overlap instead of leaving hairline gaps.
 */
export function drawSegments(v: View, queue: BakeQueue, first: number, last: number): void {
  const { ctx } = v;
  const k = v.zoom * v.dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
  const x0 = Math.round(-v.left * k);
  const x1 = Math.round((WORLD_W - v.left) * k);
  for (let i = first; i <= last; i++) {
    const img = queue.getBaked(i) ?? queue.getPlaceholder(i);
    const y0 = Math.round((i * SEG_H - v.top) * k);
    const y1 = Math.round(((i + 1) * SEG_H - v.top) * k) + 1;
    ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0);
  }
}

/** Sets the world transform: world units -> device pixels. */
export function setWorldTransform(v: View): void {
  const k = v.zoom * v.dpr;
  v.ctx.setTransform(k, 0, 0, k, -v.left * k, -v.top * k);
}
