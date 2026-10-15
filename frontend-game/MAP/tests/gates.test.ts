import { describe, expect, it } from 'vitest';
import { ENTRANCES, GATES } from '../data/gates';
import { NODES } from '../data/nodes';
import { KINGDOM_H, kingdomBottomY } from '../data/world';

describe('gates and entrances', () => {
  it('match the committed design table', () => {
    expect(GATES).toHaveLength(2);
    expect(GATES[0]).toMatchObject({ kingdom: 1, archX: 887, archY: 12777, frontX: 887, frontY: 12827, nextSpawnX: 600, nextSpawnY: 12158 });
    expect(GATES[1]).toMatchObject({ kingdom: 2, archX: 1000, archY: 6568, frontX: 1000, frontY: 6618, nextSpawnX: 1174, nextSpawnY: 5949 });
    expect(ENTRANCES[0]).toMatchObject({ kingdom: 1, hit: { x: 20, y: 18260, w: 390, h: 210 }, spawnX: 175, spawnY: 18515 });
    expect(ENTRANCES[1]).toMatchObject({ kingdom: 2, hit: { x: 440, y: 12148, w: 320, h: 200 }, spawnX: 600, spawnY: 12158 });
    expect(ENTRANCES[2]).toMatchObject({ kingdom: 3, hit: { x: 1014, y: 5939, w: 320, h: 200 }, spawnX: 1174, spawnY: 5949 });
  });

  it('L45 to gate front is 100-250 and the front is straight above L45', () => {
    for (const g of GATES) {
      const l45 = NODES[(g.kingdom - 1) * 45 + 44];
      const d = Math.hypot(g.frontX - l45.x, g.frontY - l45.y);
      expect(d).toBeGreaterThanOrEqual(100);
      expect(d).toBeLessThanOrEqual(250);
      expect(g.archX).toBe(l45.x);
    }
  });

  it('hit rects are big enough, inside their kingdom, and contain their spawn (expanded by 120)', () => {
    for (const e of ENTRANCES) {
      expect(e.hit.w).toBeGreaterThanOrEqual(320);
      expect(e.hit.h).toBeGreaterThanOrEqual(200);
      const bottom = kingdomBottomY(e.kingdom);
      expect(e.hit.y).toBeGreaterThanOrEqual(bottom - KINGDOM_H);
      expect(e.hit.y + e.hit.h).toBeLessThanOrEqual(bottom);
      expect(e.spawnX).toBeGreaterThanOrEqual(e.hit.x - 120);
      expect(e.spawnX).toBeLessThanOrEqual(e.hit.x + e.hit.w + 120);
      expect(e.spawnY).toBeGreaterThanOrEqual(e.hit.y - 120);
      expect(e.spawnY).toBeLessThanOrEqual(e.hit.y + e.hit.h + 120);
    }
  });
});
