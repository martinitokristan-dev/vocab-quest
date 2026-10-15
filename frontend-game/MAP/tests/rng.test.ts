import { describe, expect, it } from 'vitest';
import { hash, hash01, mulberry32 } from '../src/core/rng';

describe('rng', () => {
  it('mulberry32 is deterministic and in [0,1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds give different streams', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('hash is stable and spreads values', () => {
    expect(hash(1, 2, 3)).toBe(hash(1, 2, 3));
    expect(hash(1, 2, 3)).not.toBe(hash(3, 2, 1));
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(hash(i, 7));
    expect(seen.size).toBe(500);
    const f = hash01(5, 6);
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThan(1);
  });
});
