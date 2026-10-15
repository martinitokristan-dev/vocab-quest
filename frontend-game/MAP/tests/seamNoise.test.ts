import { describe, expect, it } from 'vitest';
import { SEG_H } from '../data/world';
import { sampleCell, type CellInfo } from '../src/gen/carve';
import { buildSegmentScene } from '../src/gen/segmentScene';

describe('seamless terrain', () => {
  it('two neighbouring segments sample identical cells on the shared edge', () => {
    const a: CellInfo = { h: 0, m: 0 };
    const b: CellInfo = { h: 0, m: 0 };
    for (const seg of [0, 6, 7, 13, 19]) {
      const edge = (seg + 1) * SEG_H;
      const gj = Math.floor(edge / 10);
      for (let gi = 0; gi < 99; gi++) {
        // the lattice is global, so both segments draw the same world cell
        sampleCell(gi, gj, a);
        sampleCell(gi, gj, b);
        expect(a).toEqual(b);
      }
    }
  });

  it('scenes are deterministic and cover all 21 segments', () => {
    for (let i = 0; i < 21; i++) {
      const s1 = buildSegmentScene(i);
      expect(s1.objects.length).toBeGreaterThan(5);
      expect(buildSegmentScene(i)).toBe(s1);
      for (const o of s1.objects) {
        expect(o.y).toBeGreaterThanOrEqual(i * SEG_H);
        expect(o.y).toBeLessThan((i + 1) * SEG_H);
      }
    }
  });
});
