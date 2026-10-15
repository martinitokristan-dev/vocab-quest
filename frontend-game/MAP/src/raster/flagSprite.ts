import { createSurface, ctxOf, type Ctx2D, type Surface } from './canvas';

export type FlagKind = 'ph' | 'yellow';

export const FLAG_W = 48;
export const FLAG_H = 32;
export const FLAG_SLICES = 12;

function star(ctx: Ctx2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.42;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

/** Flag drawn from geometry (no bitmaps): Philippine (blue, red, white triangle, sun, 3 stars) or plain yellow. */
export function makeFlagSprite(kind: FlagKind, scale = 2): Surface {
  const s = createSurface(FLAG_W * scale, FLAG_H * scale);
  const ctx = ctxOf(s);
  ctx.scale(scale, scale);
  if (kind === 'yellow') {
    ctx.fillStyle = '#f5c518';
    ctx.fillRect(0, 0, FLAG_W, FLAG_H);
    ctx.fillStyle = '#d9a406';
    ctx.fillRect(0, FLAG_H - 4, FLAG_W, 4);
    return s;
  }
  ctx.fillStyle = '#0038a8';
  ctx.fillRect(0, 0, FLAG_W, FLAG_H / 2);
  ctx.fillStyle = '#ce1126';
  ctx.fillRect(0, FLAG_H / 2, FLAG_W, FLAG_H / 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(FLAG_W * 0.5, FLAG_H / 2);
  ctx.lineTo(0, FLAG_H);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fcd116';
  ctx.beginPath();
  ctx.arc(FLAG_W * 0.14, FLAG_H / 2, 3.6, 0, Math.PI * 2);
  ctx.fill();
  star(ctx, 3.5, 4.5, 2.4);
  star(ctx, 3.5, FLAG_H - 4.5, 2.4);
  star(ctx, FLAG_W * 0.4, FLAG_H / 2, 2.4);
  return s;
}

/** Draws a flag as 12 vertical slices with a travelling sine offset (DESIGN 8). (x, y) is the pole attach point. */
export function drawWavingFlag(
  ctx: CanvasRenderingContext2D,
  flag: Surface,
  x: number,
  y: number,
  t: number,
  amp = 3,
  phase = 0,
): void {
  const sw = flag.width / FLAG_SLICES;
  const dw = FLAG_W / FLAG_SLICES;
  for (let i = 0; i < FLAG_SLICES; i++) {
    const dy = Math.sin(t * 4 + i * 0.6 + phase) * amp * (i / FLAG_SLICES);
    ctx.drawImage(flag, i * sw, 0, sw, flag.height, x + i * dw, y + dy, dw + 0.5, FLAG_H);
  }
}
