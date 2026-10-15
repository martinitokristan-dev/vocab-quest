import type { KingdomId } from '../../src/api/types';
import { K1_DECOR, K1_SEGMENTS } from './k1';
import { K2_DECOR, K2_SEGMENTS } from './k2';
import { K3_DECOR, K3_SEGMENTS } from './k3';
import type { DecorMix, SegmentSpec } from './types';

/** Scene scripts of the procedural segments by kingdom (K1 S1 is the hand-placed reference scene). */
export const SEGMENT_SPECS: Readonly<Record<KingdomId, readonly SegmentSpec[]>> = {
  1: K1_SEGMENTS,
  2: K2_SEGMENTS,
  3: K3_SEGMENTS,
};

export const KINGDOM_DECOR: Readonly<Record<KingdomId, DecorMix>> = { 1: K1_DECOR, 2: K2_DECOR, 3: K3_DECOR };
