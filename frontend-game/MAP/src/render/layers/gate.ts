import { KINGDOM_H, WORLD_W, kingdomBottomY } from '../../../data/world';
import type { GateRecord } from '../../../data/world';
import type { KingdomId } from '../../api/types';
import { hash01 } from '../../core/rng';
import type { View } from '../frame';
import { PADLOCK_BOX, Sprites } from '../sprites';

/** Gate opening (half width, height) in world units per gate, from the arch models (9 x 7 unit voxels). */
const OPENING: Record<number, { halfW: number; h: number }> = {
  1: { halfW: 81, h: 126 },
  2: { halfW: 90, h: 133 },
};

const mistGradients = new Map<number, CanvasGradient>();

/** Dark mist over the lower half of a locked kingdom (alpha up to 0.58) with a few drifting puffs. */
export function drawMist(v: View, k: KingdomId): void {
  const { ctx } = v;
  const y1 = kingdomBottomY(k);
  const y0 = y1 - KINGDOM_H / 2;
  if (y1 < v.top || y0 > v.bottom) return;
  let g = mistGradients.get(k);
  if (!g) {
    g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, 'rgba(30,41,59,0)');
    g.addColorStop(0.1, 'rgba(30,41,59,0.5)');
    g.addColorStop(1, 'rgba(30,41,59,0.58)');
    mistGradients.set(k, g);
  }
  const a = Math.max(y0, v.top);
  const b = Math.min(y1, v.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(v.left, a, v.right - v.left, b - a);
  if (v.tier === 'low') return;
  ctx.fillStyle = 'rgba(176,190,208,0.12)';
  for (let i = 0; i < 7; i++) {
    const y = y1 - 140 - i * 210;
    if (y < v.top - 160 || y > v.bottom + 160) continue;
    const x = ((hash01(k, i, 3) * (WORLD_W + 500) + v.time * (6 + (i % 3) * 3)) % (WORLD_W + 500)) - 250;
    ctx.beginPath();
    ctx.ellipse(x, y, 190 + (i % 3) * 40, 46, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export interface PadlockAnim {
  lift: number;
  angle: number;
  wobble: number;
  alpha: number;
  scale: number;
}

/** Unlock animation of the padlock at progress p in 0..1 (wobble, shackle lifts and swings, then fade). */
export function padlockAnimAt(p: number): PadlockAnim {
  const wob = p < 0.25 ? Math.sin((p / 0.25) * Math.PI * 4) * 4 * (1 - p / 0.25) : 0;
  const open = Math.min(1, Math.max(0, (p - 0.2) / 0.4));
  const fade = Math.min(1, Math.max(0, (p - 0.65) / 0.35));
  return { lift: open, angle: open * 0.7, wobble: wob, alpha: 1 - fade, scale: 1 + fade * 0.25 };
}

/** 3D steel padlock centred at (x, y); `anim` omitted draws the closed lock with a gentle bob. */
export function drawPadlock(v: View, sprites: Sprites, x: number, y: number, size: number, anim?: PadlockAnim): void {
  const { ctx } = v;
  const a = anim ?? { lift: 0, angle: 0, wobble: 0, alpha: 1, scale: 1 };
  const bob = anim ? 0 : Math.sin(v.time * 2) * 2;
  const s = (size * a.scale) / PADLOCK_BOX;
  ctx.save();
  ctx.globalAlpha = a.alpha;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.48, size * 0.34, size * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(x + a.wobble, y + bob);
  ctx.scale(s, s);
  ctx.translate(-PADLOCK_BOX / 2, -PADLOCK_BOX / 2);
  // shackle: upper half ring on two legs, lifted and swung open on unlock
  ctx.translate(42, 30);
  ctx.rotate(-a.angle);
  ctx.translate(-42, -30 - a.lift * 9);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 6.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(22, 30);
  ctx.lineTo(22, 22);
  ctx.arc(32, 22, 10, Math.PI, 0);
  ctx.lineTo(42, 30);
  ctx.stroke();
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(32, 22, 11.5, Math.PI * 1.05, Math.PI * 1.45);
  ctx.stroke();
  ctx.restore();
  // body
  ctx.save();
  ctx.globalAlpha = a.alpha;
  ctx.translate(x + a.wobble, y + bob);
  ctx.scale(s, s);
  ctx.drawImage(sprites.padlockBody() as CanvasImageSource, -PADLOCK_BOX / 2, -PADLOCK_BOX / 2, PADLOCK_BOX, PADLOCK_BOX);
  ctx.restore();
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Gate doors sliding apart (900 ms, p = 0..1) with an additive light shaft and 12 rising sparkles. Drawn before the
 * object pass so the arch pillars and the avatar stay in front. Reduced motion: p jumps to its end value (instant open).
 */
export function drawGateDoors(v: View, g: GateRecord, p: number): void {
  const { ctx } = v;
  const o = OPENING[g.kingdom];
  const slide = easeOutCubic(Math.min(1, Math.max(0, p / 0.8))) * o.halfW;
  const top = g.archY - o.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(g.archX - o.halfW, top, o.halfW * 2, o.h);
  ctx.clip();
  if (p > 0.02 || slide > 0) {
    // light shaft behind the doors
    ctx.globalCompositeOperation = 'lighter';
    const sg = ctx.createLinearGradient(0, g.archY, 0, top - 140);
    sg.addColorStop(0, `rgba(255,236,170,${(0.7 * p).toFixed(3)})`);
    sg.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(g.archX - o.halfW, top - 140, o.halfW * 2, o.h + 140);
    ctx.globalCompositeOperation = 'source-over';
  }
  for (const dir of [-1, 1]) {
    const x0 = dir < 0 ? g.archX - o.halfW - slide : g.archX + slide;
    ctx.fillStyle = '#7c4a1d';
    ctx.fillRect(x0, top, o.halfW, o.h);
    ctx.fillStyle = '#9a6330';
    for (let y = top + 6; y < g.archY; y += 18) ctx.fillRect(x0 + 3, y, o.halfW - 6, 2);
    ctx.fillStyle = '#d4a017';
    for (let y = top + 14; y < g.archY - 6; y += 28) ctx.fillRect(x0 + (dir < 0 ? o.halfW - 12 : 6), y, 6, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x0 + (dir < 0 ? o.halfW - 4 : 0), top, 4, o.h);
  }
  ctx.restore();
  // sparkles rising from the opening (deterministic)
  if (p > 0.05 && v.tier !== 'low') {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) {
      const r = hash01(g.kingdom, i, 91);
      const life = Math.min(1, p * 1.1);
      const x = g.archX + (r - 0.5) * o.halfW * 1.6;
      const y = g.archY - 10 - life * (60 + r * 120);
      ctx.fillStyle = `rgba(255,244,190,${(0.9 * (1 - life * 0.6)).toFixed(3)})`;
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

const CONFETTI = 60;
const CONFETTI_COLORS = ['#fbbf24', '#f472b6', '#38bdf8', '#34d399', '#f87171', '#a78bfa'];

/** Finale confetti (fixed pool, world space): falls and spins around a centre point. */
export class Confetti {
  private readonly x = new Float32Array(CONFETTI);
  private readonly y = new Float32Array(CONFETTI);
  private readonly vy = new Float32Array(CONFETTI);
  private readonly vx = new Float32Array(CONFETTI);
  private readonly life = new Float32Array(CONFETTI);
  private seed = 1;

  burst(cx: number, cy: number): void {
    for (let i = 0; i < CONFETTI; i++) {
      const r = hash01(this.seed, i, 17);
      this.x[i] = cx + (r - 0.5) * 520;
      this.y[i] = cy - 260 - hash01(this.seed, i, 18) * 260;
      this.vx[i] = (hash01(this.seed, i, 19) - 0.5) * 40;
      this.vy[i] = 50 + hash01(this.seed, i, 20) * 90;
      this.life[i] = 2.6 + hash01(this.seed, i, 21) * 1.4;
    }
    this.seed++;
  }

  step(dt: number): void {
    for (let i = 0; i < CONFETTI; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
    }
  }

  draw(v: View): void {
    const { ctx } = v;
    for (let i = 0; i < CONFETTI; i++) {
      if (this.life[i] <= 0) continue;
      if (this.y[i] < v.top - 20 || this.y[i] > v.bottom + 20) continue;
      ctx.fillStyle = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      ctx.globalAlpha = Math.min(1, this.life[i]);
      const w = 6 + (i % 3) * 2;
      ctx.fillRect(this.x[i], this.y[i], w, 4 + (i % 2) * 2);
    }
    ctx.globalAlpha = 1;
  }

  get active(): boolean {
    for (let i = 0; i < CONFETTI; i++) if (this.life[i] > 0) return true;
    return false;
  }
}
