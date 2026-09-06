import { gameApi } from '../api';

export type ScreenType = 'title' | 'loading' | 'join' | 'world_map' | 'question' | 'completed';

interface RouterConfig {
  onScreenChange: (screen: ScreenType) => void;
  onProfileRestore: (profile: { playerName?: string; avatarSlug?: string; pin?: string; token?: string | null }) => void;
  onPinUpdate: (pin: string) => void;
}

/**
 * Router utilities
 * Pure extraction from main.ts router methods
 */

/**
 * Get URL path for a given screen
 * @param screen - Current screen
 * @param pin - Current PIN (for join screen)
 * @returns URL path
 */
export function getPathForScreen(screen: ScreenType, pin: string = ''): string {
  switch (screen) {
    case 'title':
      return '/';
    case 'join':
      return pin ? `/join?pin=${encodeURIComponent(pin)}` : '/join';
    case 'world_map':
      return '/map';
    case 'question':
      return '/play';
    case 'completed':
      return '/completed';
    default:
      return '/';
  }
}

/**
 * Sync URL with screen state
 * @param screen - Current screen
 * @param pin - Current PIN
 * @param replace - Use replaceState instead of pushState
 */
export function syncUrl(screen: ScreenType, pin: string = '', replace: boolean = false): void {
  if (screen === 'loading') return;
  const targetPath = getPathForScreen(screen, pin);
  const currentFull = window.location.pathname + window.location.search;

  if (currentFull !== targetPath) {
    if (replace) {
      window.history.replaceState({ screen }, '', targetPath);
    } else {
      window.history.pushState({ screen }, '', targetPath);
    }
  }
}

/**
 * Initialize router with event listeners
 * @param config - Router configuration callbacks
 */
export function initRouter(config: RouterConfig): void {
  window.addEventListener('popstate', () => {
    handlePopState(config);
  });

  // Parse initial route and restore student session profile if active
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(window.location.search);
  const pinFromUrl = params.get('pin') || '';
  const profile = gameApi.getSessionProfile();

  if (profile.playerName || profile.avatarSlug || profile.pin) {
    config.onProfileRestore(profile);
  }
  if (pinFromUrl) {
    config.onPinUpdate(pinFromUrl);
  }

  // Set initial screen based on URL
  const hasToken = Boolean(profile.token);
  let initialScreen: ScreenType = 'title';

  if (path === '/join') {
    initialScreen = 'join';
  } else if (path === '/map' || path === '/world-map') {
    initialScreen = hasToken ? 'world_map' : 'join';
  } else if (path === '/play' || path === '/question') {
    initialScreen = hasToken ? 'question' : 'join';
  } else if (path === '/completed') {
    initialScreen = 'completed';
  } else {
    initialScreen = hasToken ? 'world_map' : 'title';
  }

  config.onScreenChange(initialScreen);
  syncUrl(initialScreen, profile.pin || pinFromUrl, true);
}

/**
 * Handle browser popstate (back/forward navigation)
 * @param config - Router configuration callbacks
 */
function handlePopState(config: RouterConfig): void {
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const profile = gameApi.getSessionProfile();
  const hasToken = Boolean(profile.token);

  if (profile.playerName || profile.avatarSlug || profile.pin) {
    config.onProfileRestore(profile);
  }

  if (path === '/join') {
    config.onScreenChange('join');
  } else if (path === '/map' || path === '/world-map') {
    config.onScreenChange(hasToken ? 'world_map' : 'join');
  } else if (path === '/play' || path === '/question') {
    config.onScreenChange(hasToken ? 'question' : 'join');
  } else if (path === '/completed') {
    config.onScreenChange('completed');
  } else {
    config.onScreenChange(hasToken ? 'world_map' : 'title');
  }
}
