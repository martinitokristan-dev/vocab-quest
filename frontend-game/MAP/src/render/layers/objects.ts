import { KINGDOM_H } from '../../../data/world';
import { MODELS } from '../../../data/models';
import { BUSH, TREE_OAK } from '../../../data/models/props';
import type { KingdomId } from '../../api/types';
import { OBJ_FLAG, OBJ_SPRITE, OBJ_TREE, type SceneObject } from '../../gen/scatter';
import { spriteSize } from '../../raster/voxelRaster';
import type { View } from '../frame';
import { BUSH_FACTOR, Sprites, TREE_FACTOR } from '../sprites';
import { AVATAR_TYPE, drawAvatar, type AvatarDraw } from './avatar';
import { drawFlag, drawLampGlow, drawSway } from './effects';
import { NODE_TYPE, drawNode, type NodeDraw } from './nodes';
import type { WaterFx } from './water';

export type Drawable = SceneObject | NodeDraw | AvatarDraw;

export function kingdomAtY(y: number): KingdomId {
  return Math.min(3, Math.max(1, 3 - Math.floor(y / KINGDOM_H))) as KingdomId;
}

const TREE_SWAY = 0.025;
const BUSH_SWAY = 0.04;

/** Authored tree and bush models that sway (rotation amplitude in radians; trees 0.025, bushes and reeds 0.04). */
const SWAY_AMP: Readonly<Record<string, number>> = {
  oak_s: TREE_SWAY,
  oak_m: TREE_SWAY,
  oak_l: TREE_SWAY,
  oak_xl: TREE_SWAY,
  apple: TREE_SWAY,
  palm_a: TREE_SWAY,
  palm_b: TREE_SWAY,
  acacia: TREE_SWAY,
  cypress: 0.015,
  bush: BUSH_SWAY,
  bush_y: BUSH_SWAY,
  bush_o: BUSH_SWAY,
  bush_p: BUSH_SWAY,
  bush_w: BUSH_SWAY,
  reed: BUSH_SWAY,
};

/** Depth-sorted pass: trees, bushes, flags, nodes and the avatar, culled against the view expanded by 64 units. */
export function drawObjects(v: View, sprites: Sprites, items: Drawable[], water: WaterFx): void {
  const { ctx } = v;
  const shadows = v.tier === 'high';
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.t === NODE_TYPE) {
      const n = it as NodeDraw;
      if (v.plain && n.state.level > 13) continue;
      if (n.y < v.top - 140 || n.y > v.bottom + 140) continue;
      drawNode(v, sprites, n);
    } else if (it.t === AVATAR_TYPE) {
      if (!v.plain) drawAvatar(v, it as AvatarDraw);
    } else if (it.t === OBJ_SPRITE) {
      const o = it as SceneObject;
      const model = MODELS[o.m as string];
      if (!model) continue;
      const f = o.f ?? 1;
      const size = spriteSize(model);
      const w = size.w * f;
      const h = size.h * f;
      if (o.x + w / 2 < v.left || o.x - w / 2 > v.right || o.y - h > v.bottom || o.y < v.top) continue;
      const amp = SWAY_AMP[o.m as string];
      if (amp !== undefined) {
        drawSway(v, sprites.sprite(o.m as string, kingdomAtY(o.y)), o.x - w / 2, o.y - h, w, h, o.x, o.x * 0.037 + o.y * 0.011, amp);
        continue;
      }
      ctx.drawImage(sprites.sprite(o.m as string, kingdomAtY(o.y)), o.x - w / 2, o.y - h, w, h);
      if (o.m === 'waterfall') water.drawFall(v, o.x, o.y, w, h, o.x * 0.01);
      else if (o.m === 'lamp') drawLampGlow(v, sprites.glow(), o.x, o.y - h * 0.68, 64 * f, o.x * 0.1);
    } else if (it.t === OBJ_FLAG) {
      const o = it as SceneObject;
      const fw = o.w ?? 0;
      const fh = o.h ?? 0;
      if (o.x + fw < v.left || o.x - fw > v.right || o.y - fh - 12 > v.bottom || o.y + 12 < v.top) continue;
      drawFlag(v, sprites.flag(o.m as 'ph' | 'yellow'), o.x - fw / 2, o.y - fh, fw, fh, o.x * 0.05);
    } else {
      const o = it as SceneObject;
      if (o.x < v.left - 160 || o.x > v.right + 160) continue;
      const k = kingdomAtY(o.y);
      const tree = o.t === OBJ_TREE;
      const f = tree ? TREE_FACTOR[o.variant] : BUSH_FACTOR[o.variant];
      const model = tree ? TREE_OAK : BUSH;
      const sprite = tree ? sprites.tree(k, o.variant) : sprites.bush(k, o.variant);
      const w = model.size[0] * 18 * f;
      const h = (model.size[1] * 10 + model.size[2] * 14) * f;
      const ax = model.anchor[0] * f;
      const ay = model.anchor[1] * f;
      if (o.y - ay > v.bottom || o.y - ay + h < v.top) continue;
      if (shadows) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.ellipse(o.x + 6, o.y + 2, w * 0.3, w * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      drawSway(v, sprite, o.x - ax, o.y - ay, w, h, o.x, o.phase, tree ? TREE_SWAY : BUSH_SWAY);
    }
  }
}

/** Sort key: the avatar stands on top of its node, so it sorts after anything at the same base. */
export function sortKey(d: Drawable): number {
  if (d.t === AVATAR_TYPE) return d.y + 340;
  if (d.t === NODE_TYPE) return d.y + 300; // level blocks always read above scenery
  return (d as SceneObject).ky ?? d.y;
}
