import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NODES } from '../data/nodes';
import { GATES } from '../data/gates';
import { K1_S1_FOOTPRINTS, footprintWorld } from '../data/scenes/k1';
import { K1_ANCHORS_REF, K1_S1_REF_Y0 } from '../data/spines';
import { KINGDOM_H, WORLD_H, WORLD_W, kingdomBottomY } from '../data/world';
import { computeLayout, nearestNode, validateNodes } from '../src/core/layout';
import { distToSegment } from '../src/core/math';
import { buildGatesSource, buildNodesSource, dataDir } from '../tools/generate-nodes';

const norm = (s: string) => s.replace(/\r\n/g, '\n');
const byLevel = (k: number, l: number) => NODES[(k - 1) * 45 + l - 1];

function distToRect(x: number, y: number, r: { x0: number; y0: number; x1: number; y1: number }): number {
  const dx = Math.max(r.x0 - x, 0, x - r.x1);
  const dy = Math.max(r.y0 - y, 0, y - r.y1);
  return Math.hypot(dx, dy);
}

describe('nodes', () => {
  it('has exactly 135 records in order (AC1)', () => {
    expect(NODES).toHaveLength(135);
    NODES.forEach((n, i) => {
      expect(n.globalIndex).toBe(i + 1);
      expect(n.kingdom).toBe(Math.floor(i / 45) + 1);
      expect(n.level).toBe((i % 45) + 1);
      expect(n.blockH).toBeGreaterThanOrEqual(54);
      expect(n.blockH).toBeLessThanOrEqual(66);
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(WORLD_W);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(WORLD_H);
      expect(n.segment).toBe(Math.floor(n.y / 887));
    });
  });

  it('spacing is 90-200 except the two tagged bridge hops (AC2)', () => {
    expect(validateNodes(NODES)).toEqual([]);
    const hops = NODES.filter((n) => n.hop === 'bridge');
    expect(hops.map((n) => n.globalIndex)).toEqual([4, 9]);
    for (const h of hops) {
      const p = NODES[h.globalIndex - 2];
      const d = Math.hypot(h.x - p.x, h.y - p.y);
      expect(d).toBeGreaterThan(200);
      expect(d).toBeLessThanOrEqual(250);
    }
  });

  it('every kingdom stays inside its own y range and climbs upward', () => {
    for (const k of [1, 2, 3] as const) {
      const bottom = kingdomBottomY(k);
      for (let l = 1; l <= 45; l++) {
        const n = byLevel(k, l);
        expect(n.y).toBeLessThan(bottom);
        expect(n.y).toBeGreaterThan(bottom - KINGDOM_H);
      }
      expect(byLevel(k, 45).y).toBeLessThan(byLevel(k, 1).y - 5000);
    }
  });

  it('K1 L1-13 are within 12 units of the reference anchors (AC3)', () => {
    const measured = [
      [175, 775], [352, 722], [502, 667], [713, 540], [808, 565], [925, 573], [1043, 566],
      [1153, 537], [1270, 368], [1345, 413], [1430, 445], [1525, 472], [1637, 488],
    ];
    measured.forEach(([x, y], i) => {
      const n = byLevel(1, i + 1);
      expect(Math.hypot(n.x - x, n.y - (K1_S1_REF_Y0 + y))).toBeLessThanOrEqual(12);
    });
    K1_ANCHORS_REF.forEach(([x, y], i) => {
      const n = byLevel(1, i + 1);
      expect(Math.hypot(n.x - x, n.y - (K1_S1_REF_Y0 + y))).toBeLessThan(0.1);
    });
  });

  it('K1 pins A and B and corridor clearances hold', () => {
    const a = byLevel(1, 17);
    const b = byLevel(1, 18);
    expect(a).toMatchObject({ x: 1245, y: K1_S1_REF_Y0 + 496 });
    expect(b).toMatchObject({ x: 1196, y: K1_S1_REF_Y0 + 304 });
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThanOrEqual(200);
    for (let l = 14; l <= 45; l++) {
      const n = byLevel(1, l);
      for (const ref of [8, 9]) {
        const r = byLevel(1, ref);
        expect(Math.hypot(n.x - r.x, n.y - r.y)).toBeGreaterThanOrEqual(90);
      }
    }
  });

  it('nodes keep 60 units from every non-bridge K1 footprint (L14-45)', () => {
    for (const f of K1_S1_FOOTPRINTS.filter((f) => !f.bridge)) {
      const r = footprintWorld(f);
      for (let l = 14; l <= 45; l++) {
        const n = byLevel(1, l);
        expect(distToRect(n.x, n.y, r), `${f.name} vs L${l}`).toBeGreaterThanOrEqual(60);
      }
    }
  });

  it('boardwalk polyline keeps 45 units from L1-12 centres', () => {
    const p = computeLayout().paths[1];
    const start = p.nodeArc[12];
    const idx = p.cum.findIndex((c) => c >= start);
    for (let i = idx; i < p.pts.length - 1; i++) {
      for (let l = 1; l <= 12; l++) {
        const n = byLevel(1, l);
        expect(distToSegment(n.x, n.y, p.pts[i].x, p.pts[i].y, p.pts[i + 1].x, p.pts[i + 1].y)).toBeGreaterThanOrEqual(45);
      }
    }
  });

  it('nearestNode: nearest wins, ties go to the lower globalIndex', () => {
    const two = [byLevel(1, 10), byLevel(1, 11)];
    const mid = { x: (two[0].x + two[1].x) / 2, y: (two[0].y + two[1].y) / 2 };
    expect(nearestNode(two, mid.x, mid.y, 48)?.level).toBe(10);
    expect(nearestNode(two, two[1].x + 1, two[1].y, 48)?.level).toBe(11);
    expect(nearestNode(two, 0, 0, 48)).toBeNull();
  });

  it('committed files equal a fresh regeneration (determinism)', () => {
    expect(norm(readFileSync(path.join(dataDir(), 'nodes.ts'), 'utf8'))).toBe(norm(buildNodesSource()));
    expect(norm(readFileSync(path.join(dataDir(), 'gates.ts'), 'utf8'))).toBe(norm(buildGatesSource()));
    expect(computeLayout().nodes).toEqual(NODES);
    expect(computeLayout().gates).toEqual(GATES);
  });
});
