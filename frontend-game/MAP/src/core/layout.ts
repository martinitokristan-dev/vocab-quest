import type { KingdomId, NodeRecord } from '../api/types';
import { SPINES, type SpineDef } from '../../data/spines';
import {
  GATE_FRONT_DISTANCE,
  KINGDOMS,
  LEVELS_PER_KINGDOM,
  TOTAL_LEVELS,
  WORLD_H,
  WORLD_W,
  kingdomBottomY,
  segmentForY,
  uToWorldY,
  type EntranceRecord,
  type GateRecord,
} from '../../data/world';
import { dist, type Pt } from './math';

export const SAMPLES_PER_SEGMENT = 48;
export { segmentForY };

/** Dense polyline of one kingdom's route with an arc-length table. */
export interface KingdomPath {
  readonly kingdom: KingdomId;
  readonly pts: Pt[];
  readonly cum: number[]; // cumulative arc length per sample
  readonly nodeArc: number[]; // arc position of level l at index l-1
  /** Arc position of the gate front (K1, K2 only). */
  readonly frontArc?: number;
  readonly gateFront?: Pt;
}

export interface Layout {
  readonly nodes: NodeRecord[];
  readonly gates: GateRecord[];
  readonly entrances: EntranceRecord[];
  readonly paths: Record<KingdomId, KingdomPath>;
}

/** Centripetal Catmull-Rom (alpha 0.5, Barry-Goldman) through waypoints. */
export function sampleSpline(points: readonly Pt[], perSegment = SAMPLES_PER_SEGMENT): Pt[] {
  const n = points.length;
  const get = (i: number): Pt => {
    if (i < 0) return { x: 2 * points[0].x - points[1].x, y: 2 * points[0].y - points[1].y };
    if (i >= n) return { x: 2 * points[n - 1].x - points[n - 2].x, y: 2 * points[n - 1].y - points[n - 2].y };
    return points[i];
  };
  const out: Pt[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const t0 = 0;
    const t1 = t0 + Math.max(Math.sqrt(dist(p0.x, p0.y, p1.x, p1.y)), 1e-4);
    const t2 = t1 + Math.max(Math.sqrt(dist(p1.x, p1.y, p2.x, p2.y)), 1e-4);
    const t3 = t2 + Math.max(Math.sqrt(dist(p2.x, p2.y, p3.x, p3.y)), 1e-4);
    for (let s = 0; s < perSegment; s++) {
      const t = t1 + ((t2 - t1) * s) / perSegment;
      const mix = (a: Pt, b: Pt, ta: number, tb: number): Pt => {
        const w = (t - ta) / (tb - ta);
        return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w };
      };
      const a1 = mix(p0, p1, t0, t1);
      const a2 = mix(p1, p2, t1, t2);
      const a3 = mix(p2, p3, t2, t3);
      const b1 = mix(a1, a2, t0, t2);
      const b2 = mix(a2, a3, t1, t3);
      out.push(mix(b1, b2, t1, t2));
    }
  }
  out.push({ ...points[n - 1] });
  return out;
}

export function cumulative(pts: readonly Pt[]): number[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y));
  return cum;
}

/** Index i such that cum[i] <= s < cum[i+1]. */
function findIndex(cum: readonly number[], s: number): number {
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function pointAtArc(path: { pts: readonly Pt[]; cum: readonly number[] }, s: number): Pt {
  const last = path.cum.length - 1;
  if (s <= 0) return { ...path.pts[0] };
  if (s >= path.cum[last]) return { ...path.pts[last] };
  const i = findIndex(path.cum, s);
  const seg = path.cum[i + 1] - path.cum[i];
  const w = seg === 0 ? 0 : (s - path.cum[i]) / seg;
  return {
    x: path.pts[i].x + (path.pts[i + 1].x - path.pts[i].x) * w,
    y: path.pts[i].y + (path.pts[i + 1].y - path.pts[i].y) * w,
  };
}

const round1 = (v: number): number => Math.round(v * 10) / 10;

function buildPath(spine: SpineDef): { path: KingdomPath; levelPts: Pt[] } {
  const pts = sampleSpline(spine.waypoints);
  const cum = cumulative(pts);
  const nodeArc: number[] = new Array(LEVELS_PER_KINGDOM).fill(0);
  for (let f = 0; f < spine.fixed.length - 1; f++) {
    const a = spine.fixed[f];
    const b = spine.fixed[f + 1];
    const sa = cum[a.wp * SAMPLES_PER_SEGMENT];
    const sb = cum[b.wp * SAMPLES_PER_SEGMENT];
    for (let l = a.level; l <= b.level; l++) {
      nodeArc[l - 1] = sa + ((sb - sa) * (l - a.level)) / (b.level - a.level);
    }
  }
  const levelPts = nodeArc.map((s) => pointAtArc({ pts, cum }, s));
  let frontArc: number | undefined;
  let gateFront: Pt | undefined;
  if (spine.kingdom !== 3) {
    const end = pts[pts.length - 1];
    const front = { x: end.x, y: end.y - GATE_FRONT_DISTANCE };
    for (let i = 1; i <= 10; i++) pts.push({ x: end.x, y: end.y - (GATE_FRONT_DISTANCE * i) / 10 });
    const cum2 = cumulative(pts);
    cum.length = 0;
    cum.push(...cum2);
    frontArc = cum[cum.length - 1];
    gateFront = front;
  }
  return { path: { kingdom: spine.kingdom, pts, cum, nodeArc, frontArc, gateFront }, levelPts };
}

function entranceFor(k: KingdomId, levelPts: Record<KingdomId, Pt[]>): EntranceRecord {
  if (k === 1) {
    const l1 = levelPts[1][0];
    return { kingdom: 1, hit: { x: 20, y: 18260, w: 390, h: 210 }, spawnX: round1(l1.x), spawnY: round1(l1.y) };
  }
  const l1 = levelPts[k][0];
  return {
    kingdom: k,
    hit: { x: round1(l1.x - 160), y: uToWorldY(k, 170) - 100, w: 320, h: 200 },
    spawnX: round1(l1.x),
    spawnY: uToWorldY(k, 260),
  };
}

let cached: Layout | undefined;

/** Deterministic layout: nodes, gates, entrances and dense walk paths. */
export function computeLayout(): Layout {
  if (cached) return cached;
  const built = ([1, 2, 3] as KingdomId[]).map((k) => buildPath(SPINES[k]));
  const paths = { 1: built[0].path, 2: built[1].path, 3: built[2].path } as Record<KingdomId, KingdomPath>;
  const levelPts = { 1: built[0].levelPts, 2: built[1].levelPts, 3: built[2].levelPts } as Record<KingdomId, Pt[]>;

  const nodes: NodeRecord[] = [];
  for (const k of [1, 2, 3] as KingdomId[]) {
    const kname = KINGDOMS[k - 1].name;
    const bridge = new Set(SPINES[k].bridgeLevels);
    for (let l = 1; l <= LEVELS_PER_KINGDOM; l++) {
      const p = levelPts[k][l - 1];
      const y = round1(p.y);
      const base = {
        kingdom: k,
        level: l,
        globalIndex: (k - 1) * LEVELS_PER_KINGDOM + l,
        x: round1(p.x),
        y,
        blockH: 54 + ((l * 7 + k * 3) % 13),
        segment: segmentForY(y),
        station: `${kname} - Level ${l}`,
      };
      nodes.push(bridge.has(l) ? { ...base, hop: 'bridge' as const } : base);
    }
  }

  const entrances = ([1, 2, 3] as KingdomId[]).map((k) => entranceFor(k, levelPts));
  const gates: GateRecord[] = ([1, 2] as const).map((k) => {
    const l45 = levelPts[k][LEVELS_PER_KINGDOM - 1];
    const next = entrances[k];
    return {
      kingdom: k,
      archX: round1(l45.x),
      archY: kingdomBottomY(k) - 5850,
      frontX: round1(l45.x),
      frontY: round1(l45.y - GATE_FRONT_DISTANCE),
      nextSpawnX: next.spawnX,
      nextSpawnY: next.spawnY,
    };
  });

  cached = { nodes, gates, entrances, paths };
  return cached;
}

export interface ValidateOptions {
  minSpacing?: number;
  maxSpacing?: number;
  maxBridgeSpacing?: number;
}

/** Returns a list of problems (empty when valid). */
export function validateNodes(nodes: readonly NodeRecord[], opts: ValidateOptions = {}): string[] {
  const { minSpacing = 90, maxSpacing = 200, maxBridgeSpacing = 250 } = opts;
  const errors: string[] = [];
  if (nodes.length !== TOTAL_LEVELS) errors.push(`expected ${TOTAL_LEVELS} nodes, got ${nodes.length}`);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.globalIndex !== i + 1) errors.push(`node ${i} has globalIndex ${n.globalIndex}`);
    if (!(n.x >= 0 && n.x <= WORLD_W && n.y >= 0 && n.y <= WORLD_H)) errors.push(`node ${n.globalIndex} outside world`);
    if (i > 0 && n.kingdom === nodes[i - 1].kingdom) {
      const p = nodes[i - 1];
      const d = dist(p.x, p.y, n.x, n.y);
      const max = n.hop === 'bridge' ? maxBridgeSpacing : maxSpacing;
      if (d < minSpacing || d > max) errors.push(`spacing ${p.globalIndex}->${n.globalIndex} = ${d.toFixed(1)} outside ${minSpacing}-${max}`);
    }
  }
  return errors;
}

/** Nearest node centre within radius; ties go to the lower globalIndex. */
export function nearestNode(nodes: readonly NodeRecord[], x: number, y: number, radius: number): NodeRecord | null {
  let best: NodeRecord | null = null;
  let bestD = Infinity;
  for (const n of nodes) {
    const d = dist(x, y, n.x, n.y);
    if (d <= radius && (d < bestD || (d === bestD && best !== null && n.globalIndex < best.globalIndex))) {
      best = n;
      bestD = d;
    }
  }
  return best;
}
