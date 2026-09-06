import { Icons } from '../../icons';
import { soundManager } from '../../soundManager';
import { gameApi } from '../../api';

interface PauseMenuModalProps {
  onClose: () => void;
  onReturnToMap: () => void;
  onOpenSettings: () => void;
  onQuitToTitle: () => void;
  onClearPollInterval: () => void;
}

/**
 * PauseMenuModal component - Renders the in-game pause menu
 * Pure extraction from main.ts renderModals method
 */
export class PauseMenuModal {
  private container: HTMLElement;
  private props: PauseMenuModalProps;

  constructor(props: PauseMenuModalProps) {
    this.props = props;
    this.container = document.createElement('div');
    this.container.id = 'modalContainer';
    this.container.className = 'modal-overlay';
  }

  /**
   * Render the modal
   */
  render(): void {
    this.container.innerHTML = `
      <div class="modal-dialog pause-menu-card">
        <div class="pause-menu-header">
          <div class="pause-menu-title">
            <span>${Icons.menu(22)}</span>
            <span>GAME PAUSED</span>
          </div>
        </div>

        <div class="pause-menu-buttons">
          <button id="pauseContinueBtn" class="pause-btn pause-btn-green">
            <span>${Icons.play(20)}</span>
            <span>CONTINUE QUEST</span>
          </button>

          <button id="pauseWorldMapBtn" class="pause-btn pause-btn-blue">
            <span>${Icons.map(20)}</span>
            <span>RETURN TO WORLD MAP</span>
          </button>

          <button id="pauseSettingsBtn" class="pause-btn pause-btn-yellow">
            <span>${Icons.refresh(20)}</span>
            <span>SETTINGS</span>
          </button>

          <button id="pauseQuitBtn" class="pause-btn pause-btn-red">
            <span>${Icons.x(20)}</span>
            <span>QUIT TO TITLE</span>
          </button>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    const contBtn = document.getElementById('pauseContinueBtn');
    const mapBtn = document.getElementById('pauseWorldMapBtn');
    const settBtn = document.getElementById('pauseSettingsBtn');
    const quitBtn = document.getElementById('pauseQuitBtn');

    contBtn?.addEventListener('mouseenter', () => soundManager.playHover());
    mapBtn?.addEventListener('mouseenter', () => soundManager.playHover());
    settBtn?.addEventListener('mouseenter', () => soundManager.playHover());
    quitBtn?.addEventListener('mouseenter', () => soundManager.playHover());

    contBtn?.addEventListener('click', () => {
      soundManager.playClick();
      this.props.onClose();
    });

    mapBtn?.addEventListener('click', () => {
      soundManager.playClick();
      soundManager.stopSpeech();
      this.props.onReturnToMap();
    });

    settBtn?.addEventListener('click', () => {
      soundManager.playClick();
      this.props.onOpenSettings();
    });

    quitBtn?.addEventListener('click', () => {
      soundManager.playClick();
      soundManager.stopSpeech();
      gameApi.clearSession();
      this.props.onClearPollInterval();
      this.props.onQuitToTitle();
    });
  }

  /**
   * Mount the modal to the body
   */
  mount(): void {
    document.body.appendChild(this.container);
  }

  /**
   * Remove the modal from the DOM
   */
  destroy(): void {
    this.container.remove();
  }
}
