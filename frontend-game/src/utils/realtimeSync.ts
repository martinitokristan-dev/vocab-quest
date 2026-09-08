// Real-time cross-tab synchronization channel (Zero polling, Zero RAM overhead)

export const SYNC_CHANNEL_NAME = 'vocab_quest_sync';

export type SyncMessage =
  | { type: 'FEEDBACK_AUDIO_CHANGED' }
  | { type: 'QUESTION_CHANGED'; mapId?: number }
  | { type: 'MAP_CHANGED' }
  | { type: 'ROOM_STATUS_CHANGED' };

let sharedBroadcastChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!sharedBroadcastChannel) {
    try {
      sharedBroadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    } catch {
      sharedBroadcastChannel = null;
    }
  }
  return sharedBroadcastChannel;
}

/**
 * Broadcast a real-time event to all open tabs and windows (game and portal)
 */
export function broadcastSync(message: SyncMessage): void {
  try {
    const channel = getBroadcastChannel();
    channel?.postMessage(message);
  } catch (err) {
    console.warn('Failed to broadcast sync event:', err);
  }
}

/**
 * Subscribe to real-time events from other tabs and windows
 */
export function subscribeSync(onMessage: (message: SyncMessage) => void): () => void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return () => {};
  }
  try {
    const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      if (event.data && typeof event.data === 'object') {
        onMessage(event.data);
      }
    };
    return () => {
      try {
        channel.close();
      } catch {}
    };
  } catch {
    return () => {};
  }
}
