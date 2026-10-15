import { describe, expect, it } from 'vitest';
import { MODELS } from '../data/models';
import { modelBounds } from '../data/models/build';
import { K1_FLAGS, K1_LANDMARKS } from '../data/scenes/k1';
import { K1_TERRAIN } from '../data/scenes/k1-terrain';
import { buildK1S1Objects } from '../src/gen/k1Scene';
import { OBJ_SPRITE } from '../src/gen/scatter';

describe('K1 S1 hand-placed scene', () => {
  it('every landmark has a model with finite opaque bounds', () => {
    for (const lm of K1_LANDMARKS) {
      const m = MODELS[lm.m];
      expect(m, lm.id).toBeDefined();
      const b = modelBounds(m);
      expect(Number.isFinite(b.left) && b.right > b.left && b.bottom > b.top, lm.id).toBe(true);
    }
  });

  it('terrain table covers the 1774x887 reference in 18x10 cells', () => {
    expect(K1_TERRAIN.length).toBe(89);
    for (const row of K1_TERRAIN) expect(row.length).toBe(99);
  });

  it('is deterministic and uses only known models, with scatter disabled', () => {
    const a = buildK1S1Objects();
    expect(a.length).toBeGreaterThan(120);
    for (const o of a) if (o.t === OBJ_SPRITE) expect(MODELS[o.m as string], String(o.m)).toBeDefined();
    expect(K1_FLAGS.length).toBe(0);
  });
});
