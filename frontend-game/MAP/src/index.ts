import { Game2DMapRenderer } from '../../src/game2d';
import { soundManager } from '../../src/soundManager';
import { ModernWorldMap } from './ModernWorldMap';
import type { MapRenderer, MapSoundHooks } from './api/types';
import { getFlowMode, resolveRequestedMode, setFlowMode, type FlowMode } from './flow/flowMode';

export { ModernWorldMap } from './ModernWorldMap';
export type { MapRenderer, StarHistoryItem } from './api/types';
export type { FlowMode } from './flow/flowMode';
export { kingdomIdOf, kingdomByMapId, kingdomForMapId, rememberMap } from './flow/kingdomMap';

const FAILED_KEY = 'vq_map_voxel_failed';

type LegacyArgs = ConstructorParameters<typeof Game2DMapRenderer>;

/** True when the modern/voxel renderer is requested (see flowMode.resolveRequestedMode for the order). */
export function isVoxelMapEnabled(): boolean {
  return resolveRequestedMode() === 'voxel';
}

function soundHooks(): MapSoundHooks {
  return {
    hover: () => soundManager.playHover(),
    click: () => soundManager.playClick(),
    wrong: () => soundManager.playWrong(),
    step: () => soundManager.playStep(),
    success: () => soundManager.playSuccess(),
    whoosh: () => soundManager.playWhoosh(),
    padlockUnlock: () => soundManager.playPadlockUnlock(),
  };
}

/**
 * Same arguments as the legacy Game2DMapRenderer constructor. Builds the modern map when enabled and falls
 * back to the PNG renderer on a construction failure (remembered for the tab session).
 */
export function createMapRenderer(...args: LegacyArgs): { renderer: MapRenderer; mode: FlowMode } {
  if (isVoxelMapEnabled()) {
    try {
      const [container, avatarImgUrl, activeMapId, qIndex, customMaps, initialPos, history, flowOptions] = args;
      const renderer = new ModernWorldMap(
        container,
        avatarImgUrl ?? '/assets/mascot_girl.png',
        activeMapId ?? 1,
        qIndex ?? 1,
        customMaps,
        initialPos,
        history ?? [],
        flowOptions,
        soundHooks(),
      );
      setFlowMode('voxel');
      return { renderer, mode: 'voxel' };
    } catch (err) {
      console.error('Modern map failed, falling back to the PNG map', err);
      try {
        sessionStorage.setItem(FAILED_KEY, '1');
      } catch {
        /* storage unavailable */
      }
      // A half-built root must not stay in the container.
      args[0].querySelectorAll('.vq-modern-map-root, .vq-map-root').forEach((el) => el.remove());
    }
  }
  setFlowMode('png');
  const renderer: MapRenderer = new Game2DMapRenderer(...args);
  return { renderer, mode: getFlowMode() };
}
