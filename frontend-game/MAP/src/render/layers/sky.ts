import type { KingdomId } from '../../api/types';
import { PALETTES } from '../../raster/materials';
import type { View } from '../frame';

const gradients = new Map<string, CanvasGradient>();

/** Screen-space gradient behind the world (only visible if the viewport is wider than the world). */
export function drawSky(v: View, kingdom: KingdomId): void {
  const { ctx } = v;
  const key = `${kingdom}:${v.vh}:${v.dpr}`;
  let g = gradients.get(key);
  if (!g) {
    g = ctx.createLinearGradient(0, 0, 0, v.vh * v.dpr);
    g.addColorStop(0, PALETTES[kingdom].skyTop);
    g.addColorStop(1, PALETTES[kingdom].skyBottom);
    if (gradients.size > 12) gradients.clear();
    gradients.set(key, g);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, v.vw * v.dpr, v.vh * v.dpr);
}
