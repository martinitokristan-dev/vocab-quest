import { describe, expect, it } from 'vitest';
import { BAKE_BUDGET, bakeScale, maxBaked, segBytes, visibleMax } from '../src/render/bakeBudget';
import type { QualityTier } from '../src/core/quality';

const VIEWPORTS: Array<[string, number, number, number, QualityTier]> = [
  ['phone 390x844 dpr3', 390, 844, 3, 'high'],
  ['tablet 768x1024 dpr2', 768, 1024, 2, 'high'],
  ['laptop 1366x768 dpr1', 1366, 768, 1, 'medium'],
  ['desktop 1920x1080 dpr1', 1920, 1080, 1, 'high'],
  ['desktop 2560x1440 dpr2', 2560, 1440, 2, 'high'],
  ['low-end 360x640 dpr2', 360, 640, 2, 'low'],
];

describe('bake budget', () => {
  it('segBytes matches the design figures', () => {
    expect(segBytes(1) / 1e6).toBeCloseTo(6.29, 1);
    expect(segBytes(1.5) / 1e6).toBeCloseTo(14.2, 1);
    expect(segBytes(2) / 1e6).toBeCloseTo(25.2, 1);
  });

  it('phone 390x844: visibleMax 4, maxBaked 6, scale 1.5', () => {
    expect(visibleMax(390, 844)).toBe(4);
    expect(maxBaked(390, 844)).toBe(6);
    expect(bakeScale(390, 844, 3, 'high')).toBe(1.5);
  });

  it('desktop 1080p has visibleMax 3', () => {
    expect(visibleMax(1920, 1080)).toBe(3);
  });

  for (const [name, w, h, dpr, tier] of VIEWPORTS) {
    it(`${name}: budget respected and maxBaked >= visibleMax`, () => {
      const s = bakeScale(w, h, dpr, tier);
      expect(maxBaked(w, h) * segBytes(s)).toBeLessThanOrEqual(BAKE_BUDGET);
      expect(maxBaked(w, h)).toBeGreaterThanOrEqual(visibleMax(w, h));
      expect(s).toBeLessThanOrEqual(tier === 'low' ? 1 : tier === 'medium' ? 1.5 : 2);
    });
  }
});
