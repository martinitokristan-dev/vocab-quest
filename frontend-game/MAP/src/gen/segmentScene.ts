import type { KingdomId } from '../api/types';
import { SEGMENT_COUNT, SEG_H } from '../../data/world';
import { buildK1S1Objects } from './k1Scene';
import { buildKingdomSegment } from './kingdomScene';
import type { SceneObject } from './scatter';

export interface SegmentScene {
  readonly index: number;
  readonly kingdom: KingdomId;
  /** 1..7 from the bottom of the kingdom. */
  readonly n: number;
  readonly top: number;
  readonly objects: SceneObject[];
}

/** Global segment s (0 at the top) -> kingdom and n (DESIGN 2.3: s = (3 - k) * 7 + (7 - n)). */
export function segmentInfo(index: number): { kingdom: KingdomId; n: number } {
  return { kingdom: (3 - Math.floor(index / 7)) as KingdomId, n: 7 - (index % 7) };
}

const cache = new Map<number, SegmentScene>();

/** Scene of any of the 21 segments: hand-placed K1 S1, scripted scenes for every other segment. */
export function buildSegmentScene(index: number): SegmentScene {
  if (!Number.isInteger(index) || index < 0 || index >= SEGMENT_COUNT) throw new RangeError(`segment ${index}`);
  let s = cache.get(index);
  if (!s) {
    const { kingdom, n } = segmentInfo(index);
    const top = index * SEG_H;
    // K1 S1 is hand-placed (scatter disabled, DESIGN 14.0); every other segment follows its scene script.
    const objects = index === 20 ? buildK1S1Objects() : buildKingdomSegment(kingdom, n, top);
    s = { index, kingdom, n, top, objects };
    cache.set(index, s);
  }
  return s;
}
