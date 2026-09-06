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
    console.log('Loaded feedback audios:', res);
    console.log('Praise clips count:', res.praise.length);
    console.log('Cheer_up clips count:', res.cheer_up.length);
    return res;
  } catch (e) {
    console.warn('Failed to load feedback voice audios:', e);
    return { praise: [], cheer_up: [] };
  }
}

/**
 * Select a random praise clip for the current map
 * @param feedbackAudios - Loaded feedback audios
 * @param activeMapId - Current map/kingdom ID
 * @returns Selected praise clip or null
 */
export function selectPraiseClip(
  feedbackAudios: FeedbackAudios,
  activeMapId: number
): FeedbackAudioClip | null {
  const activePraiseClips = feedbackAudios.praise.filter(
    (p) => p.is_active !== false && (p.map_id == null || p.map_id === activeMapId)
  );
  console.log('Current activeMapId:', activeMapId);
  console.log('Filtered activePraiseClips:', activePraiseClips);
  
  if (activePraiseClips.length === 0) return null;
  
  const customPraise = activePraiseClips[Math.floor(Math.random() * activePraiseClips.length)];
  console.log('Selected customPraise:', customPraise);
  if (customPraise) {
    console.log('Custom praise audio URL:', customPraise.audio_url);
  }
  
  return customPraise;
}

/**
 * Select a random cheer_up clip for the current map
 * @param feedbackAudios - Loaded feedback audios
 * @param activeMapId - Current map/kingdom ID
 * @returns Selected cheer_up clip or null
 */
export function selectCheerUpClip(
  feedbackAudios: FeedbackAudios,
  activeMapId: number
): FeedbackAudioClip | null {
  const activeCheerClips = feedbackAudios.cheer_up.filter(
    (c) => c.is_active !== false && (c.map_id == null || c.map_id === activeMapId)
  );
  
  if (activeCheerClips.length === 0) return null;
  
  return activeCheerClips[Math.floor(Math.random() * activeCheerClips.length)];
}
