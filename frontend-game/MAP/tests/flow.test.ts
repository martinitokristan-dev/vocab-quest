import { describe, expect, it } from 'vitest';
import { GATES } from '../data/gates';
import { NODES } from '../data/nodes';
import { buildTransitionPlan, computeWalkPath, getStepRef, globalLevelNumber } from '../src/flow/flowAdapter';

describe('flowAdapter', () => {
  it('getStepRef resolves all 45 levels per kingdom without modulo; level 46 is null', () => {
    const seen = new Set<string>();
    for (const k of [1, 2, 3]) {
      for (let q = 1; q <= 45; q++) {
        const r = getStepRef(k, q);
        expect(r).not.toBeNull();
        expect(r).toMatchObject({ mapId: k, questionIndex: q });
        seen.add(`${r!.x},${r!.y}`);
      }
      expect(getStepRef(k, 46)).toBeNull();
      expect(getStepRef(k, 0)).toBeNull();
    }
    expect(seen.size).toBe(135);
    expect(getStepRef(4, 1)).toBeNull();
    const n = NODES[0];
    const r = getStepRef(1, 1)!;
    expect(r.x).toBe(n.x);
    expect(r.y).toBeCloseTo(n.y - n.blockH / 2 + 10, 6);
  });

  it('globalLevelNumber is (k-1)*45+q', () => {
    expect(globalLevelNumber(1, 5)).toBe(5);
    expect(globalLevelNumber(2, 1)).toBe(46);
    expect(globalLevelNumber(3, 45)).toBe(135);
  });

  it('computeWalkPath starts and ends exactly on the steps', () => {
    const a = getStepRef(1, 3)!;
    const b = getStepRef(1, 9)!;
    const p = computeWalkPath(a, b);
    expect(p[0]).toEqual({ x: a.x, y: a.y });
    expect(p[p.length - 1]).toEqual({ x: b.x, y: b.y });
    for (let i = 1; i < p.length; i++) {
      expect(Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y)).toBeLessThanOrEqual(75);
    }
  });

  it('transition from L45 has no warp and ends at the gate front', () => {
    const t = buildTransitionPlan(1, 45, 2)!;
    expect(t.warpAfterIndex).toBeUndefined();
    expect(t.toStep).toMatchObject({ mapId: 2, questionIndex: 1 });
    const last = t.path[t.path.length - 1];
    expect(last.x).toBeCloseTo(GATES[0].frontX, 0);
    expect(Math.abs(last.y - GATES[0].frontY)).toBeLessThan(40);
  });

  it('5-question backend transition from L5 warps', () => {
    const t = buildTransitionPlan(1, 5, 2)!;
    expect(t.fromStep.questionIndex).toBe(5);
    expect(t.warpAfterIndex).toBeDefined();
    const t2 = buildTransitionPlan(2, 5, 3)!;
    expect(t2.warpAfterIndex).toBeDefined();
  });

  it('out-of-range from level falls back to 45; no transition out of K3', () => {
    expect(buildTransitionPlan(1, 99, 2)!.fromStep.questionIndex).toBe(45);
    expect(buildTransitionPlan(3, 45, 4)).toBeNull();
  });
});
