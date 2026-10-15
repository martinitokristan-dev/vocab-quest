import type { KingdomId } from '../src/api/types';
import { LEVEL1_U, LEVEL45_U, kingdomBottomY, uToWorldY } from './world';

/** K1 lever (DESIGN 3.3): may be lowered to 5450 if a K1 hop exceeds 200. */
export const K1_LEVEL45_U = LEVEL45_U;

export interface SpinePoint {
  readonly x: number;
  readonly y: number; // world units
}

/** A fixed node sits exactly on a waypoint; nodes between fixed ones are placed at equal arc length. */
export interface FixedNode {
  readonly level: number;
  readonly wp: number; // waypoint index
}

export interface SpineDef {
  readonly kingdom: KingdomId;
  readonly waypoints: readonly SpinePoint[];
  readonly fixed: readonly FixedNode[]; // ascending level; first and last are the spine ends
  readonly bridgeLevels: readonly number[]; // nodes reached over a tagged bridge hop
}

/** K1 S1 uses worldY = 17740 + refY, x = refX. */
export const K1_S1_REF_Y0 = 17740;

function ref(x: number, y: number): SpinePoint {
  return { x, y: K1_S1_REF_Y0 + y };
}

/** Anchors L1..L13 in reference px. L9 is nudged from (1270,368) to (1266,364) (DESIGN 3.4). */
export const K1_ANCHORS_REF: ReadonlyArray<readonly [number, number]> = [
  [175, 775], [352, 722], [502, 667], [713, 540], [808, 565], [925, 573], [1043, 566],
  [1153, 537], [1266, 364], [1345, 413], [1430, 445], [1525, 472], [1637, 488],
];

/** Boardwalk pins: L17 = A, L18 = B (reference px). */
export const K1_PIN_A_REF = [1245, 496] as const;
export const K1_PIN_B_REF = [1196, 304] as const;

/** Mid-spine waypoints of K1 beyond S1, in (x, u). */
const K1_UPPER_U: ReadonlyArray<readonly [number, number]> = [
  [850, 2300], [1050, 3900],
];

/** Waypoints are moved here when tuned (DESIGN 3.3 adjustment rule). Interior only. */
const K2_XU: ReadonlyArray<readonly [number, number]> = [
  [600, LEVEL1_U], [1450, 1438], [320, 2546], [1450, 3654], [320, 4762], [1000, LEVEL45_U],
];

const K3_XU: ReadonlyArray<readonly [number, number]> = [
  [1174, LEVEL1_U], [324, 1438], [1454, 2546], [324, 3654], [1454, 4762], [774, LEVEL45_U],
];

function fromXU(k: KingdomId, pts: ReadonlyArray<readonly [number, number]>): SpinePoint[] {
  return pts.map(([x, u]) => ({ x, y: uToWorldY(k, u) }));
}

function buildK1(): SpineDef {
  const anchors = K1_ANCHORS_REF.map(([x, y]) => ref(x, y));
  const tail: SpinePoint[] = [
    ref(1700, 557),
    ref(1450, 587),
    ref(K1_PIN_A_REF[0], K1_PIN_A_REF[1]), // wp 15, level 17
    ref(K1_PIN_B_REF[0], K1_PIN_B_REF[1]), // wp 16, level 18
    ref(1180, 120),
    { x: 1130, y: kingdomBottomY(1) - 830 }, // reference (1130,57) == u 830
    ...fromXU(1, K1_UPPER_U),
    { x: 887, y: uToWorldY(1, K1_LEVEL45_U) },
  ];
  const waypoints = [...anchors, ...tail];
  const fixed: FixedNode[] = [];
  for (let i = 0; i < 13; i++) fixed.push({ level: i + 1, wp: i });
  fixed.push({ level: 17, wp: 15 }, { level: 18, wp: 16 }, { level: 45, wp: waypoints.length - 1 });
  return { kingdom: 1, waypoints, fixed, bridgeLevels: [4, 9] };
}

function buildMirrored(k: 2 | 3, xu: ReadonlyArray<readonly [number, number]>): SpineDef {
  const waypoints = fromXU(k, xu);
  return {
    kingdom: k,
    waypoints,
    fixed: [{ level: 1, wp: 0 }, { level: 45, wp: waypoints.length - 1 }],
    bridgeLevels: [],
  };
}

export const SPINES: Readonly<Record<KingdomId, SpineDef>> = {
  1: buildK1(),
  2: buildMirrored(2, K2_XU),
  3: buildMirrored(3, K3_XU),
};
