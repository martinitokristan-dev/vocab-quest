import { hash01 } from '../../core/rng';
import type { Surface } from '../../raster/canvas';
import type { View } from '../frame';

export const FLAG_SLICE_COUNT = 12;

/** Flag cloth as 12 vertical slices with a travelling sine offset and a slope tint (DESIGN 8). Static on the low tier. */
export function drawFlag(v: View, flag: Surface, x: number, y: number, w: number, h: number, phase: number): void {
  const { ctx } = v;
  const sw = flag.width / FLAG_SLICE_COUNT;
  const dw = w / FLAG_SLICE_COUNT;
  const live = v.tier !== 'low';
  const amp = h * 0.16;
  for (let i = 0; i < FLAG_SLICE_COUNT; i++) {
    const k = i / FLAG_SLICE_COUNT;
    const arg = v.time * 4 + i * 0.6 + phase;
    const dy = live ? Math.sin(arg) * amp * k : 0;
    ctx.drawImage(flag as CanvasImageSource, i * sw, 0, sw, flag.height, x + i * dw, y + dy, dw + 0.6, h);
    if (live && v.tier === 'high') {
      const slope = Math.cos(arg);
      if (slope < 0) {
        ctx.fillStyle = `rgba(0,0,0,${(-slope * 0.12 * k).toFixed(3)})`;
        ctx.fillRect(x + i * dw, y + dy, dw + 0.6, h);
      }
    }
  }
}

/**
 * Draws a tree or bush sprite with the canopy swaying about the trunk base (the lower 38 percent stays planted).
 * `amp` is the maximum rotation in radians.
 */
export function drawSway(
  v: View,
  sprite: Surface,
  x: number,
  y: number,
  w: number,
  h: number,
  pivotX: number,
  phase: number,
  amp: number,
): void {
  const { ctx } = v;
  if (v.tier === 'low' || amp === 0) {
    ctx.drawImage(sprite as CanvasImageSource, x, y, w, h);
    return;
  }
  const split = 0.62;
  const sh = sprite.height;
  const sw = sprite.width;
  const topH = h * split;
  const trunkH = h - topH;
  const a = Math.sin(v.time * 1.3 + phase) * amp * (v.tier === 'medium' ? 0.5 : 1);
  // sub-pixel motion at the canopy top is invisible: one blit instead of two
  if (topH * Math.abs(a) * v.zoom < 0.3) {
    ctx.drawImage(sprite as CanvasImageSource, x, y, w, h);
    return;
  }
  // planted lower part
  const o = 0.6; // world-unit overlap so the two halves never leave a hairline
  const so = (o * sh) / h;
  ctx.drawImage(sprite as CanvasImageSource, 0, sh * split - so, sw, sh - sh * split + so, x, y + topH - o, w, trunkH + o);
  const px = pivotX;
  const py = y + topH;
  const k = v.zoom * v.dpr;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const A = k * c;
  const B = k * s;
  const C = -k * s;
  const E = k * (px - v.left) - (A * px + C * py);
  const F = k * (py - v.top) - (B * px + A * py);
  ctx.setTransform(A, B, C, A, E, F);
  ctx.drawImage(sprite as CanvasImageSource, 0, 0, sw, sh * split, x, y, w, topH);
  ctx.setTransform(k, 0, 0, k, -v.left * k, -v.top * k);
}

/** Additive warm glow over a lamp head (alpha 0.55 + 0.15 sin(2 t)). */
export function drawLampGlow(v: View, glow: Surface, x: number, y: number, size: number, phase: number): void {
  const { ctx } = v;
  const t = v.tier === 'low' ? 0 : v.time;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.55 + 0.15 * Math.sin(t * 2 + phase);
  ctx.drawImage(glow as CanvasImageSource, x - size / 2, y - size / 2, size, size);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

const AMBIENT_MAX = 40;
const SPARK_X = new Float32Array(AMBIENT_MAX);
const SPARK_Y = new Float32Array(AMBIENT_MAX);
const SPARK_S = new Float32Array(AMBIENT_MAX);
for (let i = 0; i < AMBIENT_MAX; i++) {
  SPARK_X[i] = hash01(i, 1, 501);
  SPARK_Y[i] = hash01(i, 2, 501);
  SPARK_S[i] = 0.4 + hash01(i, 3, 501) * 0.6;
}

let sunKey = '';
let sunGradient: CanvasGradient | null = null;

/** Sun glow (screen space, cached gradient, additive 0.18) and floating ambient sparkles (40 / 25 / 10). */
export function drawAmbient(v: View): void {
  const { ctx } = v;
  const W = v.vw * v.dpr;
  const H = v.vh * v.dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (v.tier !== 'low') {
    const key = `${W}x${H}`;
    if (key !== sunKey || !sunGradient) {
      const r = Math.max(W, H) * 0.5;
      sunGradient = ctx.createRadialGradient(W * 0.08, H * 0.04, 0, W * 0.08, H * 0.04, r);
      sunGradient.addColorStop(0, 'rgba(255,244,200,1)');
      sunGradient.addColorStop(1, 'rgba(255,244,200,0)');
      sunKey = key;
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = sunGradient;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  const n = v.tier === 'high' ? 40 : v.tier === 'medium' ? 25 : 10;
  const px = v.dpr;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const life = (SPARK_Y[i] - v.time * (0.03 + SPARK_S[i] * 0.03)) % 1;
    const f = life < 0 ? life + 1 : life;
    const x = (SPARK_X[i] + Math.sin(v.time * 0.7 + i) * 0.012) * W;
    const y = f * H;
    const alpha = Math.sin(f * Math.PI) * 0.7;
    ctx.fillStyle = `rgba(255,248,210,${alpha.toFixed(3)})`;
    const r = (1.2 + SPARK_S[i] * 1.8) * px;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
}
