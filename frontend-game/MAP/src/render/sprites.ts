import { MODELS } from '../../data/models';
import { BUSH, TREE_OAK } from '../../data/models/props';
import { K1_LANDMARKS } from '../../data/scenes/k1';
import { landmarkPlacement } from '../gen/k1Scene';
import { makeFlagSprite } from '../raster/flagSprite';
import { DECALS } from './decals';
import { rasterCloud, type Cloud } from './layers/clouds';
import type { VoxelModel } from '../../data/models/types';
import type { KingdomId, NodeStatus } from '../api/types';
import { createSurface, ctxOf, type Surface } from '../raster/canvas';
import { materialsFor } from '../raster/materials';
import { SpriteCache } from '../raster/spriteCache';
import { fontString } from '../raster/text';
import { rasterizeVoxelModel, spriteSize } from '../raster/voxelRaster';

export const NODE_W = 52;
export const NODE_MARGIN = 4;
export const NODE_TOP_H = 22;
export const STAR_BOX = 48;
export const PADLOCK_BOX = 64;

/** Draw factor per tree/bush variant (world units of sprite per model unit). */
export const TREE_FACTOR = [0.7, 0.78, 0.86] as const;
export const BUSH_FACTOR = [0.8, 0.9, 1.0] as const;

/** Rasterised sprites at one pixel scale (world unit -> bitmap px). Rebuilt when the bake scale changes. */
export class Sprites {
  private cache = new SpriteCache();
  private readonly fast = new Map<string, Surface[]>();
  private scale: number;

  constructor(scale: number) {
    this.scale = scale;
  }

  setScale(scale: number): void {
    if (scale === this.scale) return;
    this.scale = scale;
    this.fast.clear();
    this.cache.clear();
  }

  private model(m: VoxelModel, k: KingdomId, variant: number): Surface {
    return this.cache.get(`${m.name}:${k}:${variant}`, () =>
      rasterizeVoxelModel(m, materialsFor(k), { scale: this.scale, seed: 1000 + variant * 17 + k }),
    );
  }

  tree(k: KingdomId, variant: number): Surface {
    return this.model(TREE_OAK, k, variant);
  }

  bush(k: KingdomId, variant: number): Surface {
    return this.model(BUSH, k, variant);
  }

  /** Hand-placed model sprite by key (landmark decals are painted for keys that have one). */
  sprite(key: string, k: KingdomId): Surface {
    // per-frame fast path: no template-string key per draw
    let row = this.fast.get(key);
    if (!row) {
      row = [];
      this.fast.set(key, row);
    }
    return (row[k] ??= this.spriteSlow(key, k));
  }

  private spriteSlow(key: string, k: KingdomId): Surface {
    return this.cache.get(`spr:${key}:${k}`, () => {
      const model = MODELS[key];
      const s = rasterizeVoxelModel(model, materialsFor(k), { scale: this.scale, seed: 77 + key.length });
      const decal = key in DECALS ? DECALS[key] : undefined;
      const lm = decal ? K1_LANDMARKS.find((l) => l.m === key) : undefined;
      if (decal && lm) {
        const p = landmarkPlacement(key, lm.at, lm.f ?? 1);
        const ctx = ctxOf(s);
        const S = this.scale / (lm.f ?? 1);
        ctx.setTransform(S, 0, 0, S, -p.x * S / 1, -p.y * S / 1);
        decal(ctx);
      }
      return s;
    });
  }

  flag(kind: 'ph' | 'yellow'): Surface {
    return this.cache.get(`flag:${kind}`, () => makeFlagSprite(kind, 2));
  }

  /** Drifting block cloud sprite (DESIGN 8). */
  cloud(c: Cloud): Surface {
    return this.cache.get(`cloud:${c.seed}`, () => rasterCloud(c, this.scale));
  }

  /** Soft additive glow (warm white), 64 x 64 bitmap. */
  glow(): Surface {
    return this.cache.get('glow', () => {
      const s = createSurface(64, 64);
      const ctx = ctxOf(s);
      const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
      g.addColorStop(0, 'rgba(255,236,170,1)');
      g.addColorStop(0.4, 'rgba(255,214,120,0.45)');
      g.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      return s;
    });
  }

  /** Candy jelly star (ported from game2d.ts drawCandyStar), r = 16 world units, drawn in a 48 x 48 unit box. */
  star(): Surface {
    return this.cache.get('star', () => {
      const S = this.scale;
      const s = createSurface(STAR_BOX * S, STAR_BOX * S);
      const ctx = ctxOf(s);
      ctx.scale(S, S);
      ctx.translate(STAR_BOX / 2, STAR_BOX / 2 + 1);
      const r = 16;
      const innerR = r * 0.54;
      const path = (radius: number, inner: number): void => {
        ctx.beginPath();
        let rot = (Math.PI / 2) * 3;
        ctx.moveTo(0, -radius);
        for (let i = 0; i < 5; i++) {
          ctx.lineTo(Math.cos(rot) * radius, Math.sin(rot) * radius);
          rot += Math.PI / 5;
          ctx.lineTo(Math.cos(rot) * inner, Math.sin(rot) * inner);
          rot += Math.PI / 5;
        }
        ctx.closePath();
      };
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4 * S;
      ctx.shadowOffsetY = 2 * S;
      path(r + 2.5, innerR + 1.6);
      ctx.fillStyle = '#FFFFFF';
      ctx.lineJoin = 'round';
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      path(r, innerR);
      const grad = ctx.createLinearGradient(0, -r, 0, r);
      grad.addColorStop(0, '#FFF566');
      grad.addColorStop(0.25, '#FFD000');
      grad.addColorStop(0.7, '#FF9900');
      grad.addColorStop(1, '#E67300');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#9A3412';
      ctx.lineWidth = 1.8;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.42, r * 0.35, r * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, -r * 0.65, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(r * 0.35, -r * 0.05, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
      return s;
    });
  }

  /** 3D steel padlock (closed body plus shackle drawn by the caller), 64 x 64 unit box. */
  padlockBody(): Surface {
    return this.cache.get('padlock', () => {
      const S = this.scale;
      const s = createSurface(PADLOCK_BOX * S, PADLOCK_BOX * S);
      const ctx = ctxOf(s);
      ctx.scale(S, S);
      const g = ctx.createLinearGradient(14, 30, 50, 60);
      g.addColorStop(0, '#9aa7b8');
      g.addColorStop(0.5, '#5b6779');
      g.addColorStop(1, '#2b3442');
      ctx.fillStyle = g;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(13, 28, 38, 30, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(16, 31, 32, 3);
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(32, 41, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(30.5, 42, 3, 9);
      return s;
    });
  }

  /** Pink cube with the level number on the front face; grey when locked. */
  /** Pink 3D candy voxel cube with level number; rich vibrant gradients and gold lock glyph. */
  node(level: number, blockH: number, locked: boolean): Surface {
    const key = `node:${level}:${blockH}:${locked ? 1 : 0}`;
    return this.cache.get(key, () => {
      const S = this.scale;
      const w = NODE_W + NODE_MARGIN * 2;
      const h = blockH + NODE_MARGIN * 2;
      const s = createSurface(w * S, h * S);
      const ctx = ctxOf(s);
      ctx.scale(S, S);

      const x = NODE_MARGIN;
      const y = NODE_MARGIN;
      const bodyH = blockH - NODE_TOP_H;

      // Front face: 3D vertical candy gradient
      const frontGrad = ctx.createLinearGradient(0, y + NODE_TOP_H, 0, y + blockH);
      if (locked) {
        frontGrad.addColorStop(0, '#E6537E');
        frontGrad.addColorStop(1, '#A81542');
      } else {
        frontGrad.addColorStop(0, '#FF457C');
        frontGrad.addColorStop(0.55, '#E61C5B');
        frontGrad.addColorStop(1, '#BA0C42');
      }
      ctx.fillStyle = frontGrad;
      ctx.fillRect(x, y + NODE_TOP_H, NODE_W, bodyH);

      // Front face: 3D bevel left highlight
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.fillRect(x, y + NODE_TOP_H, 3.5, bodyH);

      // Front face: 3D bevel right shadow
      ctx.fillStyle = 'rgba(0,0,0,0.24)';
      ctx.fillRect(x + NODE_W - 3.5, y + NODE_TOP_H, 3.5, bodyH);

      // Top face: sunny isometric top gradient
      const topGrad = ctx.createLinearGradient(0, y, 0, y + NODE_TOP_H);
      if (locked) {
        topGrad.addColorStop(0, '#F58DA9');
        topGrad.addColorStop(1, '#CD5074');
      } else {
        topGrad.addColorStop(0, '#FFA8BD');
        topGrad.addColorStop(0.6, '#FF7A9C');
        topGrad.addColorStop(1, '#FF5B85');
      }
      ctx.fillStyle = topGrad;
      ctx.fillRect(x, y, NODE_W, NODE_TOP_H);

      // Top rim highlight strip
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(x + 1, y + 1, NODE_W - 2, 2);

      // Crisp outer bevel stroke
      ctx.strokeStyle = 'rgba(75, 5, 28, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x + 0.5, y + 0.5, NODE_W - 1, blockH - 1);

      if (locked) {
        // Metallic 3D golden padlock glyph on the top face
        const lx = x + NODE_W / 2;
        const ly = y + NODE_TOP_H / 2;

        // Golden shackle
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(lx, ly - 3, 3.8, Math.PI, 0);
        ctx.stroke();

        // Golden body with gradient
        const lockGrad = ctx.createLinearGradient(lx - 6, ly - 2.5, lx + 6, ly + 6);
        lockGrad.addColorStop(0, '#FDE047');
        lockGrad.addColorStop(0.5, '#F59E0B');
        lockGrad.addColorStop(1, '#B45309');
        ctx.fillStyle = lockGrad;
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(lx - 5.5, ly - 2.5, 11, 8.5, 2);
        ctx.fill();
        ctx.stroke();

        // Keyhole
        ctx.fillStyle = '#451A03';
        ctx.beginPath();
        ctx.arc(lx, ly + 1, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(lx - 0.7, ly + 1.2, 1.4, 2.5);
      }

      // Crisp white level text with deep shadow stroke
      ctx.font = fontString(level >= 100 ? 15 : 18);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const ty = y + NODE_TOP_H + bodyH / 2;
      ctx.lineWidth = 3.6;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#4A0218';
      ctx.strokeText(String(level), x + NODE_W / 2, ty);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(String(level), x + NODE_W / 2, ty);

      return s;
    });
  }

  get bytes(): number {
    return this.cache.bytes();
  }

  destroy(): void {
    this.fast.clear();
    this.cache.clear();
  }
}

export function modelSize(m: VoxelModel): { w: number; h: number } {
  return spriteSize(m);
}

export function isLockedStatus(s: NodeStatus, available: boolean): boolean {
  return s === 'locked' || !available;
}
