import { describe, expect, it, vi } from 'vitest';
import { avatarNode, deriveStatuses, globalLevelNumber, levelStatus } from '../src/core/status';
import type { KingdomId } from '../src/api/types';

function progress(k: KingdomId, l: number, completed: Array<{ kingdom: KingdomId; level: number; stars: number }> = []) {
  return { currentKingdom: k, currentLevel: l, completed };
}

describe('deriveStatuses', () => {
  it('covers all 135 current positions with exactly one current node', () => {
    for (let g = 1; g <= 135; g++) {
      const k = (Math.floor((g - 1) / 45) + 1) as KingdomId;
      const l = ((g - 1) % 45) + 1;
      const s = deriveStatuses(progress(k, l));
      expect(s).toHaveLength(135);
      expect(s.filter((n) => n.status === 'current')).toHaveLength(1);
      expect(s.filter((n) => n.status === 'completed')).toHaveLength(g - 1);
      expect(s.find((n) => n.status === 'current')?.globalIndex).toBe(g);
      expect(s.every((n) => n.status !== 'unlocked')).toBe(true);
    }
  });

  it('stars default to 3 for completed nodes and come from history otherwise', () => {
    const s = deriveStatuses(progress(1, 4, [{ kingdom: 1, level: 2, stars: 1 }]));
    expect(s[0].stars).toBe(3);
    expect(s[1].stars).toBe(1);
    expect(s[3].stars).toBe(0);
  });

  it('5-question backend: K2 L1 current, unavailable nodes locked', () => {
    const s = deriveStatuses(progress(2, 1), { 1: 5, 2: 5, 3: 5 });
    for (const n of s) {
      if (n.kingdom === 1 && n.level <= 5) expect(n.status).toBe('completed');
      else if (n.kingdom === 1) {
        expect(n.status).toBe('locked');
        expect(n.available).toBe(false);
        expect(n.stars).toBe(0);
      } else if (n.kingdom === 2 && n.level === 1) expect(n.status).toBe('current');
      else expect(n.status).toBe('locked');
      if (n.level > 5) expect(n.available).toBe(false);
    }
    expect(s.filter((n) => n.status === 'current')).toHaveLength(1);
  });

  it('unavailable current level: no current node, avatar on last available node', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = { 1: 5 as number, 2: 5 as number, 3: 5 as number };
    const s = deriveStatuses(progress(1, 7), a);
    expect(s.filter((n) => n.status === 'current')).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    expect(avatarNode(progress(1, 7), a)?.globalIndex).toBe(5);
    expect(avatarNode(progress(1, 3), a)?.globalIndex).toBe(3);
  });

  it('globalLevelNumber has no modulo and range checks', () => {
    expect(globalLevelNumber(1, 1)).toBe(1);
    expect(globalLevelNumber(2, 1)).toBe(46);
    expect(globalLevelNumber(3, 45)).toBe(135);
    expect(() => globalLevelNumber(1, 46)).toThrow(RangeError);
    expect(() => globalLevelNumber(4, 1)).toThrow(RangeError);
  });
});

describe('levelStatus (ModernWorldMap)', () => {
  it('on level 2 only levels before 2 are completed and level 3 stays locked', () => {
    expect(levelStatus(1, 2, true)).toBe('completed');
    expect(levelStatus(2, 2, true)).toBe('current');
    expect(levelStatus(3, 2, true)).toBe('locked');
    expect(levelStatus(4, 2, true)).toBe('locked');
  });

  it('no level is ever just "unlocked" ahead of the current one', () => {
    for (let cur = 1; cur <= 45; cur++) {
      for (let l = 1; l <= 45; l++) {
        const s = levelStatus(l, cur, true);
        expect(s).not.toBe('unlocked');
        if (l > cur) expect(s).toBe('locked');
      }
    }
  });

  it('a kingdom that is not entered yet shows every level locked', () => {
    expect(levelStatus(1, 1, false)).toBe('locked');
    expect(levelStatus(1, 5, false)).toBe('locked');
  });
});
