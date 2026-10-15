import { describe, expect, it } from 'vitest';
import { ENTRANCES, GATES } from '../data/gates';
import { MODELS } from '../data/models';
import { NODES } from '../data/nodes';
import { SEGMENT_SPECS } from '../data/scenes';
import { KINGDOMS, SEGMENT_COUNT, SEG_H, kingdomBottomY } from '../data/world';
import { computeLayout } from '../src/core/layout';
import { sampleCell, MAT_SKY, MAT_WATER } from '../src/gen/carve';
import { spriteFootprint } from '../src/gen/kingdomScene';
import { allPonds } from '../src/gen/ponds';
import { OBJ_SPRITE } from '../src/gen/scatter';
import { buildSegmentScene, segmentInfo } from '../src/gen/segmentScene';
import { isSkyAt, isSkyCell, lowerEdge, upperEdge, boundaryY } from '../src/gen/zones';
import { PALETTES } from '../src/raster/materials';
import { cloudExtent, cloudField } from '../src/render/layers/clouds';

const ON_ROUTE = /^(gate_|k2_arch|k3_arch)/;

function rectDist(x: number, y: number, r: { x0: number; y0: number; x1: number; y1: number }): number {
  return Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.y0 - y, 0, y - r.y1));
}

describe('sky seams', () => {
  it('K1 S7 sky gate zone holds >= 6 large block clouds', () => {
    const Y = boundaryY(1);
    const big = cloudField(1).filter((c) => {
      const [t, b] = cloudExtent(c);
      return c.kind === 'big' && c.cols >= 8 && t >= Y && b <= Y + 330;
    });
    expect(big.length).toBeGreaterThanOrEqual(6);
  });

  it('cloud stairs climb from the gate to the next entrance', () => {
    for (const k of [1, 2] as const) {
      const steps = cloudField(k).filter((c) => c.kind === 'step');
      expect(steps).toHaveLength(6);
      for (let i = 1; i < steps.length; i++) expect(steps[i].y).toBeGreaterThanOrEqual(steps[i - 1].y);
      expect(steps[5].y - steps[0].y).toBeGreaterThan(100);
    }
  });

  it('sky is continuous between the two land edges and nothing but sky sits there', () => {
    for (const b of [1, 2, 3] as const) {
      for (let gi = 0; gi < 99; gi++) {
        expect(lowerEdge(b, gi)).toBeGreaterThan(boundaryY(b) + 300);
        expect(upperEdge(b, gi)).toBeLessThan(boundaryY(b) - 40);
        const y = b === 3 ? lowerEdge(b, gi) / 2 : (lowerEdge(b, gi) + upperEdge(b, gi)) / 2;
        expect(isSkyCell(gi, Math.floor(y / 10)), `b${b} col ${gi}`).toBe(true);
      }
    }
    const cell = { h: 0, m: 0 };
    expect(sampleCell(40, Math.floor(boundaryY(1) / 10), cell).m).toBe(MAT_SKY);
  });

  it('no node, entrance or gate stands in the sky', () => {
    for (const n of NODES) expect(isSkyAt(n.x, n.y), `node ${n.globalIndex}`).toBe(false);
    for (const e of ENTRANCES) {
      expect(isSkyAt(e.spawnX, e.spawnY)).toBe(false);
      expect(isSkyAt(e.hit.x + e.hit.w / 2, e.hit.y + e.hit.h / 2)).toBe(false);
    }
    for (const g of GATES) {
      expect(isSkyAt(g.archX, g.archY)).toBe(false);
      expect(isSkyAt(g.frontX, g.frontY)).toBe(false);
    }
  });
});

describe('procedural segment scenes', () => {
  it('all 21 scenes build deterministically from known models, inside their segment and out of the sky', () => {
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const s = buildSegmentScene(i);
      expect(s.objects.length).toBeGreaterThan(5);
      for (const o of s.objects) {
        expect(o.y).toBeGreaterThanOrEqual(i * SEG_H);
        expect(o.y).toBeLessThan((i + 1) * SEG_H);
        if (o.t === OBJ_SPRITE) {
          expect(MODELS[o.m as string], String(o.m)).toBeDefined();
          if (i !== 20) expect(isSkyAt(o.x, o.y), `${o.m} at ${o.x},${o.y}`).toBe(false);
        }
      }
    }
  });

  it('no scene object overlaps a node or the route (K1 S1 has its own footprint rules)', () => {
    const layout = computeLayout();
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      if (i === 20) continue;
      const { kingdom } = segmentInfo(i);
      const pts = layout.paths[kingdom].pts.filter((p) => p.y > i * SEG_H - 200 && p.y < (i + 1) * SEG_H + 200);
      const nodes = NODES.filter((n) => n.y > i * SEG_H - 200 && n.y < (i + 1) * SEG_H + 200);
      for (const o of buildSegmentScene(i).objects) {
        if (o.t !== OBJ_SPRITE || ON_ROUTE.test(o.m as string)) continue;
        const fp = spriteFootprint(o.m as string, o.x, o.y, o.f ?? 1);
        for (const p of pts) expect(rectDist(p.x, p.y, fp), `${o.m} at ${o.x},${o.y} vs route`).toBeGreaterThanOrEqual(30);
        for (const n of nodes) expect(rectDist(n.x, n.y, fp), `${o.m} vs node ${n.globalIndex}`).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it('authored ponds keep clear of the route', () => {
    const layout = computeLayout();
    for (const p of allPonds()) {
      for (let a = 0; a < 48; a++) {
        const x = p.cx + Math.cos((a / 48) * Math.PI * 2) * p.rx;
        const y = p.cy + Math.sin((a / 48) * Math.PI * 2) * p.ry;
        for (const k of [1, 2, 3] as const) {
          for (const q of layout.paths[k].pts) {
            if (Math.abs(q.y - y) > 80) continue;
            expect(Math.hypot(q.x - x, q.y - y), `pond ${p.cx},${p.cy}`).toBeGreaterThan(50);
          }
        }
      }
    }
  });

  it('every authored pond is open water', () => {
    const cell = { h: 0, m: 0 };
    for (const p of allPonds()) {
      sampleCell(Math.floor(p.cx / 18), Math.floor(p.cy / 10), cell);
      expect(cell.m).toBe(MAT_WATER);
    }
  });

  it('places the gates and entrance arches', () => {
    const find = (index: number, m: string) => buildSegmentScene(index).objects.find((o) => o.m === m);
    const g1 = find(14, 'gate_k1');
    const g2 = find(7, 'gate_k2');
    expect(g1 && Math.abs(g1.x - GATES[0].archX) < 1 && Math.abs(g1.y - GATES[0].archY) < 1).toBe(true);
    expect(g2 && Math.abs(g2.x - GATES[1].archX) < 1 && Math.abs(g2.y - GATES[1].archY) < 1).toBe(true);
    for (const [index, m, k] of [[13, 'k2_arch', 2], [6, 'k3_arch', 3]] as const) {
      const o = find(index, m);
      const e = ENTRANCES[k - 1];
      expect(o).toBeDefined();
      expect(o!.x).toBeGreaterThan(e.hit.x);
      expect(o!.x).toBeLessThan(e.hit.x + e.hit.w);
      expect(o!.y).toBeGreaterThan(e.hit.y);
      expect(o!.y).toBeLessThan(e.hit.y + e.hit.h + 20);
    }
    expect(buildSegmentScene(0).objects.some((o) => o.m === 'k3_capitol_grand')).toBe(true);
    expect(GATES).toHaveLength(2);
  });

  it('kingdoms differ in palette, horizon silhouette and landmark set', () => {
    expect(PALETTES[1].grassTop).not.toBe(PALETTES[2].grassTop);
    expect(PALETTES[2].grassTop).not.toBe(PALETTES[3].grassTop);
    expect(PALETTES[1].skyTop).not.toBe(PALETTES[3].skyTop);
    const keys = (k: 1 | 2 | 3): Set<string> => {
      const out = new Set<string>();
      for (let i = 0; i < SEGMENT_COUNT; i++) {
        if (segmentInfo(i).kingdom !== k) continue;
        for (const o of buildSegmentScene(i).objects) if (o.t === OBJ_SPRITE) out.add(o.m as string);
      }
      return out;
    };
    const [a, b, c] = [keys(1), keys(2), keys(3)];
    expect(a.has('hill_a') && !b.has('hill_a') && !c.has('hill_a')).toBe(true);
    expect(b.has('mesa_a') && !a.has('mesa_a') && !c.has('mesa_a')).toBe(true);
    expect(c.has('peak_a') && !a.has('peak_a') && !b.has('peak_a')).toBe(true);
    expect(b.has('k2_colosseum') && c.has('k3_capitol_grand') && a.has('gate_k1')).toBe(true);
    for (const k of [1, 2, 3] as const) expect(SEGMENT_SPECS[k].length).toBe(k === 1 ? 6 : 7);
    expect(KINGDOMS).toHaveLength(3);
    expect(kingdomBottomY(1)).toBeGreaterThan(kingdomBottomY(2));
  });
});
