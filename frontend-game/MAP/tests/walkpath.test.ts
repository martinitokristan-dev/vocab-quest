import { describe, expect, it } from 'vitest';
import { ENTRANCES, GATES } from '../data/gates';
import { NODES } from '../data/nodes';
import type { KingdomId } from '../src/api/types';
import { computeWalkPath, MAX_SEGMENT } from '../src/core/walkPath';

const ref = (g: number) => ({ kingdom: (Math.floor((g - 1) / 45) + 1) as KingdomId, level: ((g - 1) % 45) + 1 });

describe('computeWalkPath', () => {
  it('all 135 x 135 pairs are fast, start/end at the nodes, segments <= 60, <= 600 samples', () => {
    computeWalkPath(ref(1), ref(135)); // warm the layout cache
    let elapsed = Infinity;
    let all: Array<ReturnType<typeof computeWalkPath>> = [];
    for (let rep = 0; rep < 3; rep++) {
      const t0 = performance.now();
      all = [];
      for (let a = 1; a <= 135; a++) for (let b = 1; b <= 135; b++) all.push(computeWalkPath(ref(a), ref(b)));
      elapsed = Math.min(elapsed, performance.now() - t0);
    }
    expect(elapsed).toBeLessThan(150);
    let i = 0;
    let maxLen = 0;
    let maxSeg = 0;
    let maxEndErr = 0;
    for (let a = 1; a <= 135; a++) {
      for (let b = 1; b <= 135; b++) {
        const p = all[i++];
        maxLen = Math.max(maxLen, p.length);
        const e = p[p.length - 1];
        maxEndErr = Math.max(
          maxEndErr,
          Math.hypot(p[0].x - NODES[a - 1].x, p[0].y - NODES[a - 1].y),
          Math.hypot(e.x - NODES[b - 1].x, e.y - NODES[b - 1].y),
        );
        for (let s = 1; s < p.length; s++) maxSeg = Math.max(maxSeg, Math.hypot(p[s].x - p[s - 1].x, p[s].y - p[s - 1].y));
      }
    }
    expect(maxLen).toBeLessThanOrEqual(600);
    expect(maxEndErr).toBeLessThan(0.2);
    expect(maxSeg).toBeLessThanOrEqual(MAX_SEGMENT + 1e-6);
  });

  it('cross-kingdom paths pass the gate front and the next entrance spawn', () => {
    const p = computeWalkPath(ref(40), ref(50));
    const near = (x: number, y: number) => p.some((q) => Math.hypot(q.x - x, q.y - y) < 1);
    expect(near(GATES[0].frontX, GATES[0].frontY)).toBe(true);
    expect(near(ENTRANCES[1].spawnX, ENTRANCES[1].spawnY)).toBe(true);
  });

  it('same-node path is a valid two-point polyline', () => {
    expect(computeWalkPath(ref(7), ref(7))).toHaveLength(2);
  });
});
