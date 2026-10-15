import type { View } from '../frame';

export const AVATAR_TYPE = 3;
export const AVATAR_H = 72;

const DUST_MAX = 24;

/** Fixed-size pool of run-dust puffs (no allocation per frame). */
export class DustPool {
  private readonly x = new Float32Array(DUST_MAX);
  private readonly y = new Float32Array(DUST_MAX);
  private readonly size = new Float32Array(DUST_MAX);
  private readonly op = new Float32Array(DUST_MAX);
  private readonly vx = new Float32Array(DUST_MAX);
  private readonly vy = new Float32Array(DUST_MAX);
  private next = 0;

  spawn(x: number, y: number, n = 3): void {
    for (let i = 0; i < n; i++) {
      const k = this.next++ % DUST_MAX;
      this.x[k] = x + ((this.next * 7) % 6) - 3;
      this.y[k] = y + ((this.next * 5) % 4) - 2;
      this.size[k] = 3 + (this.next % 3);
      this.op[k] = 0.55;
      this.vx[k] = (((this.next * 3) % 7) - 3) * 0.12;
      this.vy[k] = -0.25 - (this.next % 3) * 0.1;
    }
  }

  step(dt: number): void {
    const f = dt * 60;
    for (let i = 0; i < DUST_MAX; i++) {
      if (this.op[i] <= 0) continue;
      this.x[i] += this.vx[i] * f;
      this.y[i] += this.vy[i] * f;
      this.size[i] += 0.15 * f;
      this.op[i] -= 0.035 * f;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < DUST_MAX; i++) {
      if (this.op[i] <= 0) continue;
      ctx.fillStyle = `rgba(226,232,240,${this.op[i].toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(this.x[i], this.y[i], this.size[i], 0, Math.PI * 2);
      ctx.fill();
    }
  }

  get active(): number {
    let n = 0;
    for (let i = 0; i < DUST_MAX; i++) if (this.op[i] > 0) n++;
    return n;
  }
}

export interface AvatarDraw {
  readonly t: 3;
  x: number;
  y: number; // standing point (feet)
  img: HTMLImageElement | null;
  facing: 1 | -1;
  walking: boolean;
  /** Distance walked, drives the foot cycle. */
  walkDist: number;
  alpha: number;
  bubble: string;
  /** Seconds left for the speech bubble. */
  bubbleTtl: number;
  readonly dust: DustPool;
}

export function makeAvatar(img: HTMLImageElement | null): AvatarDraw {
  return { t: 3, x: 0, y: 0, img, facing: 1, walking: false, walkDist: 0, alpha: 1, bubble: '', bubbleTtl: 0, dust: new DustPool() };
}

function foot(ctx: CanvasRenderingContext2D, off: number, lift: number, white: string, accent: string): void {
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.roundRect(off - 7, lift - 6, 14, 8, 3);
  ctx.fill();
  ctx.fillStyle = white;
  ctx.beginPath();
  ctx.roundRect(off - 6, lift - 5, 12, 6, 2);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(off - 3, lift - 4, 6, 3);
}

/** Avatar with contact shadow, running feet, lean, dust and speech bubble (port of game2d.ts drawPlayerAvatar). */
export function drawAvatar(v: View, a: AvatarDraw): void {
  const { ctx } = v;
  const walking = a.walking && !v.reduced;
  const cycle = a.walkDist * 0.22;
  const sw = walking ? Math.sin(cycle) : 0;
  const bounce = walking ? -Math.abs(Math.sin(cycle)) * 9 : Math.sin(v.time * 3.5) * 3;
  const lean = walking ? a.facing * 0.14 : 0;
  const wobble = walking ? sw * 0.08 : 0;
  ctx.globalAlpha = a.alpha;
  const sh = walking ? 1 + bounce / 35 : 1;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(a.x, a.y + 3, 20 * sh, 8 * sh, 0, 0, Math.PI * 2);
  ctx.fill();
  a.dust.draw(ctx);
  if (walking) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.scale(a.facing, 1);
    foot(ctx, sw * 13, sw > 0 ? -9 * Math.sin(cycle) : 0, '#FFFFFF', '#EF4444');
    foot(ctx, -sw * 13, sw < 0 ? -9 * Math.abs(Math.sin(cycle)) : 0, '#E2E8F0', '#3B82F6');
    ctx.restore();
  }
  const img = a.img;
  ctx.save();
  ctx.translate(a.x, a.y + bounce);
  ctx.scale(a.facing, 1);
  ctx.rotate(lean + wobble);
  if (img && img.complete && img.naturalWidth > 0) {
    const w = (img.naturalWidth / img.naturalHeight) * AVATAR_H;
    ctx.drawImage(img, -w / 2, -AVATAR_H + 6, w, AVATAR_H);
  } else {
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-10, -44, 20, 44);
  }
  ctx.restore();
  if (a.bubbleTtl > 0 && a.bubble) drawBubble(v, a, bounce);
  ctx.globalAlpha = 1;
}

function drawBubble(v: View, a: AvatarDraw, bounce: number): void {
  const { ctx } = v;
  const text = a.bubble;
  ctx.font = '700 13px "Quicksand", sans-serif';
  const w = Math.max(90, ctx.measureText(text).width + 26);
  const by = a.y + bounce - AVATAR_H - 22;
  const fade = Math.min(1, a.bubbleTtl / 0.4);
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * fade;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(a.x - w / 2, by - 14, w, 28, 8);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(a.x - 5, by + 14);
  ctx.lineTo(a.x, by + 21);
  ctx.lineTo(a.x + 5, by + 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#0284C7';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, a.x, by);
  ctx.globalAlpha = prev;
}
