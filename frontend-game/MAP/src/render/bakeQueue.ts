import { SEGMENT_COUNT } from '../../data/world';
import { releaseSurface, type Surface } from '../raster/canvas';
import { SegmentBake, bakePlaceholder } from './bake';
import { segBytes } from './bakeBudget';

export const TICK_BUDGET_MS = 12;
const RETRY_SCALE = 0.75;

interface Entry {
  surface: Surface;
  scale: number;
  lastSeen: number;
}

/**
 * Owns the baked segment bitmaps: a priority list, row-sliced 12 ms ticks (setTimeout 0), LRU eviction that
 * never evicts visible segments, a permanent 1/8 scale placeholder per segment and a retry at 0.75 when a
 * canvas cannot be allocated.
 */
export class BakeQueue {
  private scale: number;
  private readonly baked = new Map<number, Entry>();
  private readonly placeholders = new Map<number, Surface>();
  private order: number[] = [];
  private current: SegmentBake | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private frame = 0;
  onChange: (() => void) | null = null;

  constructor(scale: number) {
    this.scale = scale;
  }

  get bakeScale(): number {
    return this.scale;
  }

  get bakedCount(): number {
    return this.baked.size;
  }

  get bakedBytes(): number {
    let b = 0;
    for (const e of this.baked.values()) b += segBytes(e.scale);
    for (const p of this.placeholders.values()) b += p.width * p.height * 4;
    return b;
  }

  /** Marks segments as visible this frame (LRU stamp). */
  touch(first: number, last: number): void {
    this.frame++;
    for (let i = first; i <= last; i++) {
      const e = this.baked.get(i);
      if (e) e.lastSeen = this.frame;
    }
  }

  getBaked(index: number): Surface | null {
    return this.baked.get(index)?.surface ?? null;
  }

  getPlaceholder(index: number): Surface {
    let p = this.placeholders.get(index);
    if (!p) {
      p = bakePlaceholder(index);
      this.placeholders.set(index, p);
    }
    return p;
  }

  /** Replaces the wanted list (highest priority first); already baked entries are skipped. */
  request(order: readonly number[]): void {
    if (this.destroyed) return;
    this.order = order.filter((i) => i >= 0 && i < SEGMENT_COUNT && !this.baked.has(i));
    this.schedule();
  }

  isPending(): boolean {
    return this.current !== null || this.order.length > 0;
  }

  /** Drops prefetch/old segments, least recently visible first, never a visible one, until count <= max. */
  prune(visible: readonly number[], max: number): void {
    if (this.baked.size <= max) return;
    const vis = new Set(visible);
    const candidates = [...this.baked.entries()].filter(([i]) => !vis.has(i)).sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    for (const [i, e] of candidates) {
      if (this.baked.size <= max) break;
      releaseSurface(e.surface);
      this.baked.delete(i);
    }
  }

  /** Changes the bake scale and drops everything baked at the old one. */
  setScale(scale: number): void {
    if (scale === this.scale) return;
    this.scale = scale;
    for (const e of this.baked.values()) releaseSurface(e.surface);
    this.baked.clear();
    this.current = null;
    this.order = [];
  }

  private schedule(): void {
    if (this.timer !== null || this.destroyed) return;
    if (!this.current && this.order.length === 0) return;
    this.timer = setTimeout(() => this.run(), 0);
  }

  private start(index: number, scale: number): SegmentBake | null {
    try {
      return new SegmentBake(index, scale);
    } catch {
      if (scale > RETRY_SCALE) return this.start(index, RETRY_SCALE);
      return null;
    }
  }

  private run(): void {
    this.timer = null;
    if (this.destroyed) return;
    if (!this.current) {
      const next = this.order.shift();
      if (next === undefined) return;
      this.current = this.start(next, this.scale);
      if (!this.current) {
        this.schedule();
        return;
      }
    }
    if (this.current.step(TICK_BUDGET_MS)) {
      const job = this.current;
      this.current = null;
      this.baked.set(job.index, { surface: job.surface, scale: job.scale, lastSeen: this.frame });
      this.onChange?.();
    }
    this.schedule();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.current = null;
    this.order = [];
    for (const e of this.baked.values()) releaseSurface(e.surface);
    this.baked.clear();
    for (const p of this.placeholders.values()) releaseSurface(p);
    this.placeholders.clear();
  }
}
