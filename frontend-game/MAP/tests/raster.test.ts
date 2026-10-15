import { describe, expect, it } from 'vitest';
import type { VoxelModel } from '../data/models/types';
import { BUSH, TREE_OAK } from '../data/models/props';
import type { Surface } from '../src/raster/canvas';
import { MATERIALS, shade } from '../src/raster/materials';
import { exposedFaces, rasterizeVoxelModel, spriteSize } from '../src/raster/voxelRaster';

function stubCanvas() {
  const calls = { fillRect: 0, strokeRect: 0 };
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect: () => void calls.fillRect++,
    strokeRect: () => void calls.strokeRect++,
  };
  const make = (w: number, h: number): Surface =>
    ({ width: w, height: h, getContext: () => ctx }) as unknown as Surface;
  return { calls, make };
}

const CUBE2: VoxelModel = {
  name: 'cube2',
  size: [2, 2, 2],
  layers: [['AA', 'AA'], ['AA', 'AA']],
  legend: { A: 'stone' },
  anchor: [0, 0],
};

describe('exposed-face culling', () => {
  it('2x2x2 cube exposes 4 top and 4 front faces (of 8 voxels)', () => {
    expect(exposedFaces(CUBE2)).toEqual({ voxels: 8, top: 4, front: 4 });
  });

  it('a single voxel exposes both faces', () => {
    const one: VoxelModel = { ...CUBE2, size: [1, 1, 1], layers: [['A']] };
    expect(exposedFaces(one)).toEqual({ voxels: 1, top: 1, front: 1 });
  });

  it('empty chars are ignored', () => {
    const m: VoxelModel = { ...CUBE2, size: [3, 1, 1], layers: [['A.A']] };
    expect(exposedFaces(m).voxels).toBe(2);
  });

  it('tree has fewer faces than a naive 6-per-voxel count', () => {
    const f = exposedFaces(TREE_OAK);
    expect(f.top + f.front).toBeLessThan(f.voxels * 2);
    expect(f.voxels).toBeGreaterThan(0);
  });
});

describe('rasterizeVoxelModel with a canvas stub', () => {
  it('sizes the sprite (w*18) x (d*10 + h*14) at the requested scale', () => {
    expect(spriteSize(CUBE2)).toEqual({ w: 36, h: 48 });
    const { make } = stubCanvas();
    const s = rasterizeVoxelModel(CUBE2, MATERIALS, { scale: 2, createCanvas: make });
    expect([s.width, s.height]).toEqual([72, 96]);
  });

  it('draws one fill per exposed face plus lighting strips', () => {
    const { calls, make } = stubCanvas();
    rasterizeVoxelModel(CUBE2, MATERIALS, { createCanvas: make });
    const f = exposedFaces(CUBE2);
    // top: 1 fill; front: 1 base + 2 strips
    expect(calls.fillRect).toBe(f.top + f.front * 3);
    expect(calls.strokeRect).toBe(f.top + f.front);
  });

  it('is deterministic for a seed', () => {
    const a = stubCanvas();
    const b = stubCanvas();
    rasterizeVoxelModel(BUSH, MATERIALS, { seed: 5, createCanvas: a.make });
    rasterizeVoxelModel(BUSH, MATERIALS, { seed: 5, createCanvas: b.make });
    expect(a.calls).toEqual(b.calls);
  });
});

describe('shade', () => {
  it('clamps and formats', () => {
    expect(shade('#808080', 2)).toBe('rgb(255,255,255)');
    expect(shade('#ffffff', 0)).toBe('rgb(0,0,0)');
  });
});
