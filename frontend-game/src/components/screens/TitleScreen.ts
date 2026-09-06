import { Icons } from '../../icons';
import { soundManager } from '../../soundManager';

/**
 * TitleScreen component - Renders the main title screen with mascot characters and action buttons
 * Pure extraction from main.ts renderTitleScreen method
 */
export class TitleScreen {
  private container: HTMLElement;
  private onPlayClick: () => void;
  private onHowToPlayClick: () => void;
  private onSettingsClick: () => void;

  constructor(
    container: HTMLElement,
    onPlayClick: () => void,
    onHowToPlayClick: () => void,
    onSettingsClick: () => void
  ) {
    this.container = container;
    this.onPlayClick = onPlayClick;
    this.onHowToPlayClick = onHowToPlayClick;
    this.onSettingsClick = onSettingsClick;
  }

  /**
   * Render the title screen
   */
  render(): void {
    this.container.innerHTML = `
      <div class="title-scene-container animate-fade-in">
        <div class="title-logo-container">
          <img src="/assets/vocab_logo.png" class="title-logo-img" alt="Vocab Quest" />
        </div>

        <div class="title-stage-wrapper">
          <!-- Left Mascot Character -->
          <div class="mascot-character-container girl">
            <div class="pixel-speech-bubble left">
              <span class="pixel-speech-text">
                <span>WELCOME TO</span>
                <span>PROSPERIDAD!</span>
              </span>
            </div>
            <img src="/assets/mascot_girl.png" class="mascot-character-img" alt="Mascot Girl" />
          </div>

          <!-- Center Voxel Buttons Stack -->
          <div class="voxel-buttons-stack">
            <div id="playGameBtnFrame" class="vocab-btn-frame">
              <button id="playGameBtn" class="vocab-btn vocab-btn-green">
                <span class="vocab-icon-play">${Icons.play(26)}</span>
                <span>PLAY QUEST</span>
              </button>
            </div>

            <div id="howToPlayBtnFrame" class="vocab-btn-frame">
              <button id="howToPlayBtn" class="vocab-btn vocab-btn-blue">
                <span class="vocab-icon-book">${Icons.sparkles(24)}</span>
                <span>HOW TO PLAY</span>
              </button>
            </div>

            <div id="settingsBtnFrame" class="vocab-btn-frame">
              <button id="settingsBtn" class="vocab-btn vocab-btn-yellow">
                <span class="vocab-icon-gear">${Icons.refresh(24)}</span>
                <span>SETTINGS</span>
              </button>
            </div>
          </div>

          <!-- Right Mascot Character -->
          <div class="mascot-character-container boy">
            <div class="pixel-speech-bubble right">
              <span class="pixel-speech-text">
                <span>LEARN & CONQUER</span>
                <span>THE KINGDOMS!</span>
              </span>
            </div>
            <img src="/assets/mascot_boy.png" class="mascot-character-img" alt="Mascot Boy" />
          </div>
        </div>

        <div class="title-school-footer">
          Vocab Quest v2.0 • DepEd Prosperidad District Edition
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners to buttons
   */
  private attachEventListeners(): void {
    const playFrame = document.getElementById('playGameBtnFrame');
    const howToFrame = document.getElementById('howToPlayBtnFrame');
    const settFrame = document.getElementById('settingsBtnFrame');

    playFrame?.addEventListener('mouseenter', () => soundManager.playHover());
    howToFrame?.addEventListener('mouseenter', () => soundManager.playHover());
    settFrame?.addEventListener('mouseenter', () => soundManager.playHover());

    const playAction = () => {
      soundManager.playClick();
      this.onPlayClick();
    };
    const howToAction = () => {
      soundManager.playClick();
      this.onHowToPlayClick();
    };
    const settingsAction = () => {
      soundManager.playClick();
      this.onSettingsClick();
    };

    playFrame?.addEventListener('click', playAction);
    document.getElementById('playGameBtn')?.addEventListener('click', (e) => { e.stopPropagation(); playAction(); });

    howToFrame?.addEventListener('click', howToAction);
    document.getElementById('howToPlayBtn')?.addEventListener('click', (e) => { e.stopPropagation(); howToAction(); });

    settFrame?.addEventListener('click', settingsAction);
    document.getElementById('settingsBtn')?.addEventListener('click', (e) => { e.stopPropagation(); settingsAction(); });
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    // Event listeners are automatically cleaned up when innerHTML is replaced
  }
}
