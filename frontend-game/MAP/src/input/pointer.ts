export interface PointerHandlers {
  /** Pan by a screen-space delta in CSS px (positive = content follows the finger). */
  pan(dx: number, dy: number): void;
  zoomAt(factor: number, sx: number, sy: number): void;
  /** Click or tap (movement under the drag threshold). */
  tap(sx: number, sy: number): void;
  hover(sx: number, sy: number): void;
  /** A gesture started; cancels any non-locking glide. */
  gestureStart(): void;
  isLocked(): boolean;
}

export const DRAG_THRESHOLD = 5;
const VELOCITY_WINDOW_MS = 80;
const INERTIA_DECAY = 5;
const STOP_SPEED = 5;

interface Sample {
  t: number;
  x: number;
  y: number;
}

/** Pointer Events controller: drag with threshold and inertia, wheel pan, ctrl-wheel zoom, pinch. */
export class PointerInput {
  private readonly pts = new Map<number, { x: number; y: number }>();
  private samples: Sample[] = [];
  private downX = 0;
  private downY = 0;
  private dragging = false;
  private pinchDist = 0;
  private vx = 0;
  private vy = 0;
  private reduced = false;
  private readonly onDown: (e: PointerEvent) => void;
  private readonly onMove: (e: PointerEvent) => void;
  private readonly onUp: (e: PointerEvent) => void;
  private readonly onWheel: (e: WheelEvent) => void;
  private destroyed = false;
  private readonly el: HTMLElement;
  private readonly h: PointerHandlers;

  constructor(el: HTMLElement, h: PointerHandlers) {
    this.el = el;
    this.h = h;
    this.onDown = (e) => this.down(e);
    this.onMove = (e) => this.move(e);
    this.onUp = (e) => this.up(e);
    this.onWheel = (e) => this.wheel(e);
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
  }

  setReducedMotion(v: boolean): void {
    this.reduced = v;
  }

  private local(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private down(e: PointerEvent): void {
    if (this.h.isLocked()) return;
    const p = this.local(e);
    this.pts.set(e.pointerId, p);
    this.el.setPointerCapture?.(e.pointerId);
    this.vx = this.vy = 0;
    this.h.gestureStart();
    if (this.pts.size === 1) {
      this.downX = p.x;
      this.downY = p.y;
      this.dragging = false;
      this.samples = [{ t: performance.now(), x: p.x, y: p.y }];
    } else if (this.pts.size === 2) {
      this.dragging = true;
      this.pinchDist = this.pairDistance();
    }
  }

  private pairDistance(): number {
    const [a, b] = [...this.pts.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private move(e: PointerEvent): void {
    const p = this.local(e);
    const prev = this.pts.get(e.pointerId);
    if (!prev) {
      if (e.pointerType === 'mouse') this.h.hover(p.x, p.y);
      return;
    }
    if (this.h.isLocked()) return;
    if (this.pts.size >= 2) {
      const before = [...this.pts.values()];
      const mid0 = { x: (before[0].x + before[1].x) / 2, y: (before[0].y + before[1].y) / 2 };
      this.pts.set(e.pointerId, p);
      const after = [...this.pts.values()];
      const mid1 = { x: (after[0].x + after[1].x) / 2, y: (after[0].y + after[1].y) / 2 };
      const d = this.pairDistance();
      if (this.pinchDist > 0 && d > 0) this.h.zoomAt(d / this.pinchDist, mid1.x, mid1.y);
      this.pinchDist = d;
      this.h.pan(mid1.x - mid0.x, mid1.y - mid0.y);
      return;
    }
    this.pts.set(e.pointerId, p);
    if (!this.dragging && Math.hypot(p.x - this.downX, p.y - this.downY) >= DRAG_THRESHOLD) this.dragging = true;
    if (this.dragging) {
      this.h.pan(p.x - prev.x, p.y - prev.y);
      const now = performance.now();
      this.samples.push({ t: now, x: p.x, y: p.y });
      while (this.samples.length > 2 && now - this.samples[0].t > VELOCITY_WINDOW_MS) this.samples.shift();
    }
  }

  private up(e: PointerEvent): void {
    const had = this.pts.delete(e.pointerId);
    if (!had) return;
    this.el.releasePointerCapture?.(e.pointerId);
    if (this.pts.size > 0) {
      // pinch ended: resume as a drag with no inertia
      this.samples = [];
      return;
    }
    const p = this.local(e);
    if (e.type === 'pointerup' && !this.dragging) {
      this.h.tap(p.x, p.y);
      return;
    }
    if (this.dragging && !this.reduced && this.samples.length >= 2) {
      const a = this.samples[0];
      const b = this.samples[this.samples.length - 1];
      const dt = (b.t - a.t) / 1000;
      if (dt > 0 && performance.now() - b.t < 100) {
        this.vx = (b.x - a.x) / dt;
        this.vy = (b.y - a.y) / dt;
      }
    }
    this.dragging = false;
  }

  private wheel(e: WheelEvent): void {
    e.preventDefault();
    if (this.h.isLocked()) return;
    this.h.gestureStart();
    const p = this.local(e);
    if (e.ctrlKey) {
      this.h.zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
    } else {
      this.h.pan(-e.deltaX, -e.deltaY);
    }
  }

  /** Applies inertia; call once per frame. */
  update(dt: number): void {
    if (this.pts.size > 0 || (this.vx === 0 && this.vy === 0)) return;
    this.h.pan(this.vx * dt, this.vy * dt);
    const k = Math.exp(-dt * INERTIA_DECAY);
    this.vx *= k;
    this.vy *= k;
    if (Math.hypot(this.vx, this.vy) < STOP_SPEED) this.vx = this.vy = 0;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onUp);
    this.el.removeEventListener('wheel', this.onWheel);
    this.pts.clear();
  }
}
