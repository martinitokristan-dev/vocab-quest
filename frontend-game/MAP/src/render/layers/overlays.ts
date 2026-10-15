import type { View } from '../frame';

/** Screen-space fade used by warps and entry animations (alpha 0..1). */
export function drawFade(v: View, alpha: number, color = '#0f172a'): void {
  if (alpha <= 0.002) return;
  const { ctx } = v;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, v.vw * v.dpr, v.vh * v.dpr);
  ctx.globalAlpha = 1;
}

/** Soft vignette, cached by size. */
let vignette: { key: string; g: CanvasGradient } | null = null;

export function drawVignette(v: View): void {
  const { ctx } = v;
  const W = v.vw * v.dpr;
  const H = v.vh * v.dpr;
  const key = `${W}x${H}`;
  if (!vignette || vignette.key !== key) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.55);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(10,20,40,0.22)');
    vignette = { key, g };
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = vignette.g;
  ctx.fillRect(0, 0, W, H);
}
