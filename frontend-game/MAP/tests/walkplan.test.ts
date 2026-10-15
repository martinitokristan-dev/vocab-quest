import { describe, expect, it } from 'vitest';
import { GATES } from '../data/gates';
import { NODES } from '../data/nodes';
import { animatedLength, walkPlan } from '../src/core/walkPath';

describe('walkPlan', () => {
  it('from L45 is one animated path of <= 900 units ending at the gate front', () => {
    for (const k of [1, 2] as const) {
      const plan = walkPlan({ kingdom: k, level: 45 }, { kingdom: (k + 1) as 2 | 3, level: 1 });
      expect(plan.warpAfterIndex).toBeUndefined();
      expect(animatedLength(plan)).toBeLessThanOrEqual(900);
      const last = plan.points[plan.points.length - 1];
      expect(last.x).toBeCloseTo(GATES[k - 1].frontX, 0);
      expect(last.y).toBeCloseTo(GATES[k - 1].frontY, 0);
      const first = plan.points[0];
      const l45 = NODES[(k - 1) * 45 + 44];
      expect(Math.hypot(first.x - l45.x, first.y - l45.y)).toBeLessThan(0.2);
    }
  });

  it('5-question backend (from L5) warps, animates <= 900 with no segment > 400', () => {
    for (const k of [1, 2] as const) {
      const plan = walkPlan({ kingdom: k, level: 5 });
      expect(plan.warpAfterIndex).toBeDefined();
      expect(animatedLength(plan)).toBeLessThanOrEqual(900);
      const w = plan.warpAfterIndex as number;
      for (let i = 1; i < plan.points.length; i++) {
        if (i - 1 === w) continue;
        const d = Math.hypot(plan.points[i].x - plan.points[i - 1].x, plan.points[i].y - plan.points[i - 1].y);
        expect(d).toBeLessThanOrEqual(400);
      }
      // the jump skips most of the kingdom
      const a = plan.points[w];
      const b = plan.points[w + 1];
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(1000);
      // first part walks exactly two hops from level 5 (ends at level 7)
      const l7 = NODES[(k - 1) * 45 + 6];
      expect(Math.hypot(a.x - l7.x, a.y - l7.y)).toBeLessThan(0.2);
    }
  });

  it('K3 has no gate: the plan ends at L45 without a warp', () => {
    const plan = walkPlan({ kingdom: 3, level: 40 });
    expect(plan.warpAfterIndex).toBeUndefined();
    const last = plan.points[plan.points.length - 1];
    expect(Math.hypot(last.x - NODES[134].x, last.y - NODES[134].y)).toBeLessThan(0.2);
  });

  it('rejects a target in the same or an earlier kingdom', () => {
    expect(() => walkPlan({ kingdom: 2, level: 45 }, { kingdom: 2, level: 1 })).toThrow(RangeError);
  });
});
