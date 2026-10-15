import { SEGMENT_SPECS } from '../../data/scenes';
import { kingdomBottomY } from '../../data/world';
import type { KingdomId } from '../api/types';

/** Authored water pool in world units (centre and radii). */
export interface WorldPond {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

let list: WorldPond[] | null = null;

export function allPonds(): readonly WorldPond[] {
  if (!list) {
    list = [];
    for (const k of [1, 2, 3] as KingdomId[]) {
      for (const seg of SEGMENT_SPECS[k]) {
        for (const [x, u, rx, ry] of seg.ponds ?? []) list.push({ cx: x, cy: kingdomBottomY(k) - u, rx, ry });
      }
    }
  }
  return list;
}

/** True when the world point lies inside an authored pond. */
export function pondAt(x: number, y: number): boolean {
  for (const p of allPonds()) {
    const dx = (x - p.cx) / p.rx;
    if (dx > 1 || dx < -1) continue;
    const dy = (y - p.cy) / p.ry;
    if (dx * dx + dy * dy <= 1) return true;
  }
  return false;
}
