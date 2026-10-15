import type { KingdomId, NodeRecord } from '../api/types';
import { NODES } from '../../data/nodes';
import { LEVELS_PER_KINGDOM } from '../../data/world';
import { computeWalkPath as corePath, walkPlan } from '../core/walkPath';
import type { Pt } from '../core/math';

export { LEVELS_PER_KINGDOM };

export interface StepRef {
  mapId: number;
  questionIndex: number;
  x: number;
  y: number;
  blockH: number;
}

function isKingdom(v: number): v is KingdomId {
  return Number.isInteger(v) && v >= 1 && v <= 3;
}

function nodeFor(k: number, q: number): NodeRecord | null {
  if (!isKingdom(k) || !Number.isInteger(q) || q < 1 || q > LEVELS_PER_KINGDOM) return null;
  return NODES[(k - 1) * LEVELS_PER_KINGDOM + q - 1] ?? null;
}

/** Avatar standing offset, same formula as the legacy table: y - blockH / 2 + 10. */
function standing(n: NodeRecord): Pt {
  return { x: n.x, y: n.y - n.blockH / 2 + 10 };
}

/** Step position for (kingdom, level). Level > 45 or < 1 returns null (no modulo). */
export function getStepRef(mapId: number, questionIndex: number): StepRef | null {
  const n = nodeFor(mapId, questionIndex);
  if (!n) return null;
  const p = standing(n);
  return { mapId: n.kingdom, questionIndex: n.level, x: p.x, y: p.y, blockH: n.blockH };
}

/** (k - 1) * 45 + q. */
export function globalLevelNumber(mapId: number, questionIndex: number): number {
  return (mapId - 1) * LEVELS_PER_KINGDOM + questionIndex;
}

function shifted(points: Pt[], from: StepRef, to: StepRef | null): Pt[] {
  const dy = from.y - (nodeFor(from.mapId, from.questionIndex) as NodeRecord).y;
  const out = points.map((p) => ({ x: p.x, y: p.y + dy }));
  out[0] = { x: from.x, y: from.y };
  if (to) out[out.length - 1] = { x: to.x, y: to.y };
  return out;
}

/** Walk polyline between two steps (segments <= 60 units, standing offset applied). */
export function computeWalkPath(from: StepRef, to: StepRef): Pt[] {
  const pts = corePath(
    { kingdom: from.mapId as KingdomId, level: from.questionIndex },
    { kingdom: to.mapId as KingdomId, level: to.questionIndex },
  );
  return shifted(pts, from, to);
}

export interface TransitionPlan {
  fromStep: StepRef;
  toStep: StepRef;
  path: Pt[];
  warpAfterIndex?: number;
}

/**
 * Walk after the last available level of a kingdom: to the top gate, with a warp when the approach is
 * longer than 900 units. `fromLevel` falls back to level 45 when it is out of range.
 */
export function buildTransitionPlan(fromMapId: number, fromLevel: number, toMapId: number): TransitionPlan | null {
  const fromStep = getStepRef(fromMapId, fromLevel) ?? getStepRef(fromMapId, LEVELS_PER_KINGDOM);
  const toStep = getStepRef(toMapId, 1);
  if (!fromStep || !toStep || toMapId <= fromMapId) return null;
  const plan = walkPlan({ kingdom: fromStep.mapId as KingdomId, level: fromStep.questionIndex });
  return {
    fromStep,
    toStep,
    path: shifted(plan.points, fromStep, null),
    warpAfterIndex: plan.warpAfterIndex,
  };
}
