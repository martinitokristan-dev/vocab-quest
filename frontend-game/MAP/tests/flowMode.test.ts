import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class FakeStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
}

let session: FakeStorage;
let local: FakeStorage;

function setup(search = ''): void {
  session = new FakeStorage();
  local = new FakeStorage();
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('window', { location: { search } });
}

async function load() {
  vi.resetModules();
  return import('../src/flow/flowMode');
}

describe('flowMode', () => {
  beforeEach(() => setup());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('defaults to voxel with no factory call and no env', async () => {
    const m = await load();
    expect(m.getFlowMode()).toBe('voxel');
  });

  it('is not resolved at module load (lazy)', async () => {
    const m = await load();
    session.setItem('vq_map_voxel_failed', '1');
    expect(m.getFlowMode()).toBe('png');
  });

  it('sessionStorage failure flag wins over everything', async () => {
    setup('?map=voxel');
    session.setItem('vq_map_voxel_failed', '1');
    local.setItem('vq_map_renderer', 'voxel');
    expect((await load()).getFlowMode()).toBe('png');
  });

  it('URL param is case-insensitive and persisted to localStorage', async () => {
    setup('?map=PNG');
    expect((await load()).getFlowMode()).toBe('png');
    expect(local.getItem('vq_map_renderer')).toBe('png');
  });

  it('localStorage is used next, invalid values are ignored', async () => {
    local.setItem('vq_map_renderer', 'png');
    expect((await load()).getFlowMode()).toBe('png');
    setup('?map=bogus');
    local.setItem('vq_map_renderer', 'nonsense');
    expect((await load()).getFlowMode()).toBe('voxel');
  });

  it('VITE_MAP_RENDERER is used when nothing else is set', async () => {
    vi.stubEnv('VITE_MAP_RENDERER', 'png');
    expect((await load()).getFlowMode()).toBe('png');
  });

  it('setFlowMode overwrites the cached value (factory fallback)', async () => {
    const m = await load();
    expect(m.getFlowMode()).toBe('voxel');
    m.setFlowMode('png');
    expect(m.getFlowMode()).toBe('png');
  });
});
