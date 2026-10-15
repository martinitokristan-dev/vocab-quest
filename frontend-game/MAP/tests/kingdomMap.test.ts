import { beforeEach, describe, expect, it, vi } from 'vitest';
import { kingdomByMapId, kingdomForMapId, kingdomIdOf, rememberMap } from '../src/flow/kingdomMap';

describe('kingdomMap', () => {
  beforeEach(() => kingdomByMapId.clear());

  it('kingdomIdOf uses order_index and falls back to id', () => {
    expect(kingdomIdOf({ id: 12, order_index: 2 })).toBe(2);
    expect(kingdomIdOf({ id: 3 })).toBe(3);
    expect(kingdomIdOf({ id: 3, order_index: 0 })).toBe(3);
    expect(kingdomIdOf({ id: 3, order_index: Number.NaN })).toBe(3);
  });

  it('DB ids {11,12,13} map to kingdoms 1..3', () => {
    rememberMap({ id: 11, order_index: 1 });
    rememberMap({ id: 12, order_index: 2 });
    rememberMap({ id: 13, order_index: 3 });
    expect([11, 12, 13].map(kingdomForMapId)).toEqual([1, 2, 3]);
  });

  it('unknown 99 is skipped (warned once); unknown 2 falls back to 2', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(kingdomForMapId(99)).toBeNull();
    expect(kingdomForMapId(99)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
    expect(kingdomForMapId(2)).toBe(2);
  });

  it('rememberMap ignores maps that have no valid kingdom', () => {
    rememberMap({ id: 77, order_index: 9 });
    expect(kingdomByMapId.has(77)).toBe(false);
  });
});
