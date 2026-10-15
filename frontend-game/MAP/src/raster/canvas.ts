export type Surface = HTMLCanvasElement | OffscreenCanvas;
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** OffscreenCanvas when available, otherwise a detached DOM canvas. */
export function createSurface(w: number, h: number): Surface {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(W, H);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return c;
}

export function ctxOf(s: Surface): Ctx2D {
  const c = (s as HTMLCanvasElement).getContext('2d');
  if (!c) throw new Error('2d context unavailable');
  return c;
}

/** Frees the backing store. */
export function releaseSurface(s: Surface): void {
  s.width = 0;
  s.height = 0;
}
