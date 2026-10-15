export type FlowMode = 'voxel' | 'png';

const FAILED_KEY = 'vq_map_voxel_failed';
const STORAGE_KEY = 'vq_map_renderer';

let mode: FlowMode | undefined;

function parse(v: unknown): FlowMode | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().toLowerCase();
  return s === 'voxel' || s === 'png' ? s : undefined;
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

/**
 * Order: sessionStorage vq_map_voxel_failed, URL ?map=, localStorage vq_map_renderer,
 * VITE_MAP_RENDERER, default 'voxel'. Reads only window/storage/import.meta.env.
 */
export function resolveRequestedMode(): FlowMode {
  if (safe(() => sessionStorage.getItem(FAILED_KEY))) return 'png';
  const fromUrl = parse(safe(() => new URLSearchParams(window.location.search).get('map')));
  if (fromUrl) {
    safe(() => localStorage.setItem(STORAGE_KEY, fromUrl));
    return fromUrl;
  }
  const fromStore = parse(safe(() => localStorage.getItem(STORAGE_KEY)));
  if (fromStore) return fromStore;
  const fromEnv = parse(safe(() => import.meta.env?.VITE_MAP_RENDERER));
  return fromEnv ?? 'voxel';
}

/** Lazy: resolved on first read, never at module load. */
export function getFlowMode(): FlowMode {
  if (mode === undefined) mode = resolveRequestedMode();
  return mode;
}

/** Called by the renderer factory; overwrites the cached value (e.g. after a construction-time fallback). */
export function setFlowMode(m: FlowMode): void {
  mode = m;
}
