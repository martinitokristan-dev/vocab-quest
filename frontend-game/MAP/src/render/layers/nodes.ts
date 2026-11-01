import type { NodeState } from '../../api/types';
import type { View } from '../frame';
import { NODE_MARGIN, NODE_W, STAR_BOX, Sprites } from '../sprites';

export const NODE_TYPE = 2;

export interface NodeDraw {
  readonly t: 2;
  readonly x: number;
  readonly y: number;
  state: NodeState;
  hover: boolean;
  /** Orbiting sparkles (the current node and the next one). */
  spark: boolean;
  /** Keyboard focus ring (the matching accessibility proxy has focus). */
  focus: boolean;
}

const EMERALD = '#10B981';
const GOLD = '#fbbf24';
const HOVER = '#7dd3fc';

/** Star layout under a completed node: [dx, dy, radius] per star for 1, 2 and 3 stars. */
const STAR_LAYOUT: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = [
  [[0, 0, 11]],
  [[-13, 0, 11], [13, 0, 11]],
  [[-21, 2, 10], [0, -2, 12], [21, 2, 10]],
];

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.28, y - r * 0.28);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x + r * 0.28, y + r * 0.28);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.28, y + r * 0.28);
  ctx.lineTo(x - r, y);
  ctx.lineTo(x - r * 0.28, y - r * 0.28);
  ctx.closePath();
  ctx.fill();
}

/** Node block sprite plus status decoration (current pulse and arrow, completed outline and stars, hover glow, sparkles). */
export function drawNode(v: View, sprites: Sprites, n: NodeDraw): void {
  const { ctx } = v;
  const s = n.state;
  const locked = !v.plain && (s.status === 'locked' || !s.available);
  const sprite = sprites.node(s.level, s.blockH, locked);
  const x = s.x - NODE_W / 2 - NODE_MARGIN;
  const y = s.y - s.blockH / 2 - NODE_MARGIN;
  const w = NODE_W + NODE_MARGIN * 2;
  const h = s.blockH + NODE_MARGIN * 2;
  if (locked) ctx.globalAlpha = 0.88;
  ctx.drawImage(sprite, x, y, w, h);
  if (locked) ctx.globalAlpha = 1;
  const bx = s.x - NODE_W / 2;
  const by = s.y - s.blockH / 2;
  if (v.plain) return;
  if (!s.available) {
    // "coming soon": dashed outline
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(bx - 2, by - 2, NODE_W + 4, s.blockH + 4);
    ctx.setLineDash([]);
  }
  if (s.status === 'current' && s.available) {
    const pulse = v.reduced ? 1 : 0.5 + 0.5 * Math.sin(v.time * 4.5);
    ctx.save();
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = v.reduced ? 0 : 8 + pulse * 6;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = v.reduced ? 4 : 3 + pulse * 2;
    ctx.strokeRect(bx - 2, by - 2, NODE_W + 4, s.blockH + 4);
    ctx.restore();

    const bob = v.reduced ? 0 : Math.sin(v.time * 5) * 5;
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(s.x - 10, by - 32 + bob);
    ctx.lineTo(s.x + 10, by - 32 + bob);
    ctx.lineTo(s.x, by - 15 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (s.status === 'completed') {
    ctx.strokeStyle = EMERALD;
    ctx.lineWidth = 3;
    ctx.strokeRect(bx - 1.5, by - 1.5, NODE_W + 3, s.blockH + 3);
    // 0 stars (found on the last choice) → three faded stars instead of one gold star
    const isZeroStar = s.stars === 0;
    const layout = STAR_LAYOUT[isZeroStar ? 2 : Math.min(3, Math.max(1, s.stars)) - 1];
    const star = sprites.star();
    if (isZeroStar) ctx.globalAlpha = 0.28;
    for (let i = 0; i < layout.length; i++) {
      const [dx, dy, r] = layout[i];
      const sz = (r * 2 * STAR_BOX) / 36;
      ctx.drawImage(star, s.x + dx - sz / 2, by + s.blockH + 16 + dy - sz / 2, sz, sz);
    }
    if (isZeroStar) ctx.globalAlpha = 1;
  }
  if (n.hover) {
    ctx.strokeStyle = HOVER;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.9;
    ctx.strokeRect(bx - 3, by - 3, NODE_W + 6, s.blockH + 6);
    ctx.globalAlpha = 1;
  }
  if (n.focus) {
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 7;
    ctx.strokeRect(bx - 6, by - 6, NODE_W + 12, s.blockH + 12);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(bx - 6, by - 6, NODE_W + 12, s.blockH + 12);
  }
  if (n.spark && s.available && v.tier !== 'low') {
    const count = v.tier === 'high' ? 3 : 2;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,230,140,0.85)';
    for (let i = 0; i < count; i++) {
      const a = v.time * 1.6 + (i * Math.PI * 2) / count;
      const tw = 0.55 + 0.45 * Math.sin(v.time * 6 + i * 2);
      sparkle(ctx, s.x + Math.cos(a) * 42, s.y - 4 + Math.sin(a) * 26, 4.5 * tw + 1.5);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
