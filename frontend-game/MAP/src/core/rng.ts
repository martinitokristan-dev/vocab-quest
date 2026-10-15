/** Deterministic random helpers. Generation code must never use Math.random or Date.now. */

/** mulberry32: returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 32-bit integer hash of up to four integers (FNV-1a style mixing). */
export function hash(a: number, b = 0, c = 0, d = 0): number {
  let h = 2166136261 >>> 0;
  for (const v of [a, b, c, d]) {
    h ^= v | 0;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= h >>> 13;
  }
  return h >>> 0;
}

/** Hash to a float in [0, 1). */
export function hash01(a: number, b = 0, c = 0, d = 0): number {
  return hash(a, b, c, d) / 4294967296;
}
