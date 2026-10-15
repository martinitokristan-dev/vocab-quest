import { describe, expect, it } from 'vitest';
import { WORLD_W } from '../data/world';
import { farfieldRows, farfieldScale } from '../src/gen/heightfield';

describe('far-field perspective', () => {
  it('scale curve hits its key points', () => {
    expect(farfieldScale(0)).toBeCloseTo(1, 9);
    expect(farfieldScale(450)).toBe(1);
    expect(farfieldScale(600)).toBe(1);
    expect(farfieldScale(180)).toBeCloseTo(0.78, 9);
  });

  it('rows tile from refY 450 to 0 with no gap or overlap', () => {
    const rows = farfieldRows(0, 450);
    expect(rows[0].y0).toBeCloseTo(0, 6);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].y0).toBeCloseTo(rows[i - 1].y0 + rows[i - 1].depth, 6);
    }
    const last = rows[rows.length - 1];
    expect(last.y0 + last.depth).toBeCloseTo(450, 6);
  });

  it('every row covers the full width', () => {
    for (const r of farfieldRows()) expect(r.columns * r.w).toBeGreaterThanOrEqual(WORLD_W);
  });
});
