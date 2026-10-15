import { releaseSurface, type Surface } from './canvas';

/** Lazy keyed cache of rasterised sprites. */
export class SpriteCache {
  private readonly map = new Map<string, Surface>();

  get(key: string, build: () => Surface): Surface {
    let s = this.map.get(key);
    if (!s) {
      s = build();
      this.map.set(key, s);
    }
    return s;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  get size(): number {
    return this.map.size;
  }

  /** Approximate bytes held (RGBA). */
  bytes(): number {
    let b = 0;
    for (const s of this.map.values()) b += s.width * s.height * 4;
    return b;
  }

  clear(): void {
    for (const s of this.map.values()) releaseSurface(s);
    this.map.clear();
  }
}
