import { soundManager } from '../soundManager';

interface KeyboardHandlerConfig {
  /** Enter / Space in the teacher dialogue: CONTINUE / BEGIN (only works on the last slide). */
  onDialogueBegin: () => void;
  /** Esc in the teacher dialogue: SKIP to the last slide. */
  onDialogueSkip: () => void;
  onTogglePauseMenu: () => void;
  onCloseModals: () => void;
  isDialogueOpen: () => boolean;
  isHowToPlayOpen: () => boolean;
  isSettingsOpen: () => boolean;
  isWorldMapOrQuestionScreen: () => boolean;
  isPauseMenuOpen: () => boolean;
}

/**
 * Keyboard event handler utilities
 * Pure extraction from main.ts bindGlobalKeyboard method
 */

/**
 * Bind global keyboard event listeners
 * @param config - Keyboard handler configuration callbacks
 */
export function bindGlobalKeyboard(config: KeyboardHandlerConfig): void {
  window.addEventListener('keydown', (e) => {
    if (config.isDialogueOpen()) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        soundManager.resumeOnUserGesture();
        if (!e.repeat) config.onDialogueBegin();
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        soundManager.resumeOnUserGesture();
        if (!e.repeat) config.onDialogueSkip();
        return;
      }
    }

    if (e.key === 'Escape') {
      if (config.isHowToPlayOpen() || config.isSettingsOpen()) {
        soundManager.stopSpeech();
        config.onCloseModals();
      } else if (config.isWorldMapOrQuestionScreen()) {
        soundManager.playClick();
        const nextPauseState = !config.isPauseMenuOpen();
        if (nextPauseState) {
          soundManager.stopSpeech();
        }
        config.onTogglePauseMenu();
      }
    }
  });
}
