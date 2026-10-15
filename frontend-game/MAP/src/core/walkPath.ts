import type { KingdomId } from '../api/types';
import { LEVELS_PER_KINGDOM } from '../../data/world';
import { computeLayout, type KingdomPath } from './layout';
import { dist, type Pt } from './math';

export const MAX_SEGMENT = 60;
export const WARP_LIMIT = 900;
export const APPROACH_LENGTH = 200;
export const WARP_HOPS = 2;

export interface NodeRef {
  kingdom: KingdomId;
  level: number;
}

export interface WalkPlan {
  points: Pt[];
  /** Index after which the path jumps (teleport, not a segment). */
  warpAfterIndex?: number;
}

function pathOf(k: KingdomId): KingdomPath {
  return computeLayout().paths[k];
}

function arcOf(ref: NodeRef): number {
  if (!Number.isInteger(ref.level) || ref.level < 1 || ref.level > LEVELS_PER_KINGDOM) {
    throw new RangeError(`level ${ref.level} out of range`);
  }
  return pathOf(ref.kingdom).nodeArc[ref.level - 1];
}

/** Points along the path from arc s0 to s1 (either direction), each segment at most MAX_SEGMENT. */
function slice(path: KingdomPath, s0: number, s1: number): Pt[] {
  const len = Math.abs(s1 - s0);
  const n = Math.max(1, Math.ceil(len / MAX_SEGMENT));
  const { cum, pts } = path;
  const last = cum.length - 1;
  const out: Pt[] = new Array(n + 1);
  // Samples move monotonically along the path, so walk a pointer instead of searching each time.
  let idx = 0;
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s0) lo = mid;
    else hi = mid;
  }
  idx = lo;
  for (let i = 0; i <= n; i++) {
    const s = Math.min(Math.max(s0 + ((s1 - s0) * i) / n, 0), cum[last]);
    while (idx < last - 1 && cum[idx + 1] <= s) idx++;
    while (idx > 0 && cum[idx] > s) idx--;
    const seg = cum[idx + 1] - cum[idx];
    const w = seg === 0 ? 0 : (s - cum[idx]) / seg;
    out[i] = {
      x: pts[idx].x + (pts[idx + 1].x - pts[idx].x) * w,
      y: pts[idx].y + (pts[idx + 1].y - pts[idx].y) * w,
    };
  }
  return out;
}

/** Straight run from a to b, excluding a, including b. */
function line(a: Pt, b: Pt): Pt[] {
  const n = Math.max(1, Math.ceil(dist(a.x, a.y, b.x, b.y) / MAX_SEGMENT));
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) out.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
  return out;
}

/** Precomputed per-kingdom hop polylines so a path is a cheap concatenation (135 x 135 pairs in well under 100 ms). */
interface KingdomTable {
  chain: Pt[]; // L1 ... L45, then (K1, K2) the points up to the gate front
  idx: number[]; // idx[l-1] = index of node l in chain
  next: Pt[]; // gate front -> next entrance spawn -> next L1 (excluding the front), K1, K2
}

let tables: Record<KingdomId, KingdomTable> | undefined;

function getTables(): Record<KingdomId, KingdomTable> {
  if (tables) return tables;
  const { gates, entrances } = computeLayout();
  const build = (k: KingdomId): KingdomTable => {
    const path = pathOf(k);
    const node = path.nodeArc.map((s) => slice(path, s, s)[0]);
    const chain: Pt[] = [node[0]];
    const idx: number[] = [0];
    for (let l = 1; l < LEVELS_PER_KINGDOM; l++) {
      const hop = slice(path, path.nodeArc[l - 1], path.nodeArc[l]);
      hop[hop.length - 1] = node[l];
      for (let i = 1; i < hop.length; i++) chain.push(hop[i]);
      idx.push(chain.length - 1);
    }
    let next: Pt[] = [];
    if (path.frontArc !== undefined) {
      const gate = slice(path, path.nodeArc[LEVELS_PER_KINGDOM - 1], path.frontArc);
      for (let i = 1; i < gate.length; i++) chain.push(gate[i]);
      const g = gates[k - 1];
      const spawn = entrances[k];
      const front: Pt = { x: g.frontX, y: g.frontY };
      const target: Pt = { x: spawn.spawnX, y: spawn.spawnY };
      const l1 = pathOf((k + 1) as KingdomId).pts[0];
      next = [...line(front, target), ...line(target, l1)];
    }
    return { chain, idx, next };
  };
  tables = { 1: build(1), 2: build(2), 3: build(3) };
  return tables;
}

function forwardPath(from: NodeRef, to: NodeRef): Pt[] {
  const t = getTables();
  const a = t[from.kingdom];
  if (from.kingdom === to.kingdom) {
    if (to.level >= from.level) return a.chain.slice(a.idx[from.level - 1], a.idx[to.level - 1] + 1);
    return a.chain.slice(a.idx[to.level - 1], a.idx[from.level - 1] + 1).reverse();
  }
  let out = a.chain.slice(a.idx[from.level - 1]); // includes the gate run
  for (let k = from.kingdom; k < to.kingdom; k++) {
    const cur = t[k as KingdomId];
    const nxt = t[(k + 1) as KingdomId];
    out = out.concat(cur.next, k + 1 === to.kingdom ? nxt.chain.slice(1, nxt.idx[to.level - 1] + 1) : nxt.chain.slice(1));
  }
  return out;
}

/**
 * Polyline of at most 60-unit segments between two nodes (same or different kingdom, either direction).
 * Point objects are shared between calls; treat them as read-only.
 */
export function computeWalkPath(from: NodeRef, to: NodeRef): Pt[] {
  arcOf(from);
  arcOf(to);
  if (from.kingdom <= to.kingdom) {
    const p = forwardPath(from, to);
    return p.length === 1 ? [p[0], p[0]] : p;
  }
  return forwardPath(to, from).reverse();
}

/**
 * Animated walk to the top gate of from.kingdom (the avatar then re-spawns at the next entrance).
 * `to` is accepted for symmetry with the flow API and must be in a later kingdom.
 */
export function walkPlan(from: NodeRef, to?: NodeRef): WalkPlan {
  if (to && to.kingdom <= from.kingdom) throw new RangeError('walkPlan target must be in a later kingdom');
  const path = pathOf(from.kingdom);
  const s0 = arcOf(from);
  if (path.frontArc === undefined) {
    return { points: slice(path, s0, path.nodeArc[LEVELS_PER_KINGDOM - 1]) };
  }
  const L = path.frontArc - s0;
  if (L <= WARP_LIMIT) return { points: slice(path, s0, path.frontArc) };
  const s1 = path.nodeArc[Math.min(LEVELS_PER_KINGDOM, from.level + WARP_HOPS) - 1];
  const first = slice(path, s0, s1);
  const second = slice(path, path.frontArc - APPROACH_LENGTH, path.frontArc);
  return { points: [...first, ...second], warpAfterIndex: first.length - 1 };
}

/** Sum of segment lengths, skipping the warp jump. */
export function animatedLength(plan: WalkPlan): number {
  let total = 0;
  for (let i = 1; i < plan.points.length; i++) {
    if (plan.warpAfterIndex === i - 1) continue;
    total += dist(plan.points[i - 1].x, plan.points[i - 1].y, plan.points[i].x, plan.points[i].y);
  }
  return total;
}
