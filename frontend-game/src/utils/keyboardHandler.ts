import { soundManager } from '../soundManager';

interface KeyboardHandlerConfig {
  onNextDialogueSlide: () => void;
  onCloseDialogue: () => void;
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
        config.onNextDialogueSlide();
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        config.onCloseDialogue();
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
