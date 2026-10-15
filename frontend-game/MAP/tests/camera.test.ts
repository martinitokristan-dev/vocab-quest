import { describe, expect, it } from 'vitest';
import {
  clampToWorld,
  defaultZoom,
  fitZoom,
  followTarget,
  glideAt,
  glideDuration,
  minZoom,
  smoothDamp,
  zoomAround,
} from '../src/core/camera';
import { WORLD_H, WORLD_W } from '../data/world';

describe('camera', () => {
  it('follow target sits 12% of the viewport above the avatar', () => {
    expect(followTarget(900, 5000, 800, 1).cy).toBeCloseTo(4904, 6);
    expect(followTarget(900, 5000, 800, 0.5).cy).toBeCloseTo(4808, 6);
    expect(followTarget(900, 5000, 800, 1).cx).toBe(900);
  });

  it('minZoom is max(fit, 0.46) and default zoom follows orientation', () => {
    expect(fitZoom(1774)).toBe(1);
    expect(minZoom(390)).toBe(0.46);
    expect(minZoom(1774)).toBe(1);
    expect(defaultZoom(390, 844)).toBe(0.55);
    expect(defaultZoom(1920, 1080)).toBeCloseTo(1920 / WORLD_W, 6);
  });

  it('clamps so the viewport never leaves the world', () => {
    const c = clampToWorld({ cx: -500, cy: -500, zoom: 1 }, 800, 600);
    expect(c.cx).toBe(400);
    expect(c.cy).toBe(300);
    const d = clampToWorld({ cx: 1e9, cy: 1e9, zoom: 1 }, 800, 600);
    expect(d.cx).toBe(WORLD_W - 400);
    expect(d.cy).toBe(WORLD_H - 300);
    const wide = clampToWorld({ cx: 10, cy: 5000, zoom: 0.1 }, 3000, 600);
    expect(wide.zoom).toBe(minZoom(3000));
    expect(wide.cx).toBe(WORLD_W / 2);
  });

  it('zoomAround keeps the anchor world point fixed', () => {
    const cam = { cx: 900, cy: 9000, zoom: 1 };
    const vw = 800;
    const vh = 600;
    const sx = 650;
    const sy = 120;
    const wx = cam.cx + (sx - vw / 2) / cam.zoom;
    const wy = cam.cy + (sy - vh / 2) / cam.zoom;
    const z = zoomAround(cam, 1.7, sx, sy, vw, vh);
    expect(z.zoom).toBeCloseTo(1.7, 9);
    expect(z.cx + (sx - vw / 2) / z.zoom).toBeCloseTo(wx, 6);
    expect(z.cy + (sy - vh / 2) / z.zoom).toBeCloseTo(wy, 6);
  });

  it('glideDuration is clamped to 600..1200 ms', () => {
    expect(glideDuration(0)).toBe(600);
    expect(glideDuration(1)).toBe(950);
    expect(glideDuration(10)).toBe(1200);
  });

  it('a glide never moves more than 25% of the viewport per 60 fps frame', () => {
    const vh = 800;
    for (const d of [0.1, 0.5, 1, 2, 2.5]) {
      const dur = glideDuration(d);
      const from = { cx: 900, cy: 9000, zoom: 1 };
      const to = { cx: 900, cy: 9000 - d * vh, zoom: 1 };
      const frames = Math.ceil(dur / (1000 / 60));
      let prev = from;
      for (let f = 1; f <= frames; f++) {
        const cur = glideAt(from, to, f / frames);
        expect(Math.abs(cur.cy - prev.cy) / vh).toBeLessThan(0.25);
        prev = cur;
      }
      expect(prev.cy).toBeCloseTo(to.cy, 6);
    }
  });

  it('smoothDamp converges frame-rate independently', () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = smoothDamp(a, 100, 1 / 60);
    let b = 0;
    for (let i = 0; i < 30; i++) b = smoothDamp(b, 100, 1 / 30);
    expect(a).toBeCloseTo(b, 6);
    expect(a).toBeGreaterThan(99);
  });
});
