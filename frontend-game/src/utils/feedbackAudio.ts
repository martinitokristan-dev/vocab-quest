import { gameApi } from '../api';

export interface FeedbackAudioClip {
  id: number;
  phrase: string;
  audio_url: string;
  is_active: boolean;
  map_id: number | null;
}

export interface FeedbackAudios {
  praise: FeedbackAudioClip[];
  cheer_up: FeedbackAudioClip[];
}

/**
 * Feedback audio utilities
 * Pure extraction from main.ts feedback audio methods
 */

/**
 * Load feedback audios from API
 * @returns Feedback audios object with praise and cheer_up clips
 */
export async function loadFeedbackAudios(): Promise<FeedbackAudios> {
  try {
    const res = await gameApi.getFeedbackAudios();
    return res;
  } catch (e) {
    console.warn('Failed to load feedback voice audios:', e);
    return { praise: [], cheer_up: [] };
  }
}

/**
 * Select a random praise clip for the current map
 * Prioritizes uploaded audio over fallbacks:
 * 1. First tries to find audio for current map
 * 2. Then tries to find global audio (map_id is null)
 * 3. Returns null if no uploaded audio exists (fallbacks will be used)
 * @param feedbackAudios - Loaded feedback audios
 * @param activeMapId - Current map/kingdom ID
 * @returns Selected praise clip or null
 */
export function selectPraiseClip(
  feedbackAudios: FeedbackAudios,
  activeMapId: number
): FeedbackAudioClip | null {
  // First, try to find audio specifically for current map
  let activePraiseClips = feedbackAudios.praise.filter(
    (p) => p.is_active !== false && p.map_id === activeMapId
  );
  
  // If no map-specific audio, try global audio (map_id is null)
  if (activePraiseClips.length === 0) {
    activePraiseClips = feedbackAudios.praise.filter(
      (p) => p.is_active !== false && p.map_id == null
    );
  }
  
  if (activePraiseClips.length === 0) return null;
  
  return activePraiseClips[Math.floor(Math.random() * activePraiseClips.length)];
}

/**
 * Select a random cheer_up clip for the current map
 * Prioritizes uploaded audio over fallbacks:
 * 1. First tries to find audio for current map
 * 2. Then tries to find global audio (map_id is null)
 * 3. Returns null if no uploaded audio exists (fallbacks will be used)
 * @param feedbackAudios - Loaded feedback audios
 * @param activeMapId - Current map/kingdom ID
 * @returns Selected cheer_up clip or null
 */
export function selectCheerUpClip(
  feedbackAudios: FeedbackAudios,
  activeMapId: number
): FeedbackAudioClip | null {
  // First, try to find audio specifically for current map
  let activeCheerClips = feedbackAudios.cheer_up.filter(
    (c) => c.is_active !== false && c.map_id === activeMapId
  );
  
  // If no map-specific audio, try global audio (map_id is null)
  if (activeCheerClips.length === 0) {
    activeCheerClips = feedbackAudios.cheer_up.filter(
      (c) => c.is_active !== false && c.map_id == null
    );
  }
  
  if (activeCheerClips.length === 0) return null;
  
  return activeCheerClips[Math.floor(Math.random() * activeCheerClips.length)];
}
