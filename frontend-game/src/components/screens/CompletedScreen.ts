import { Icons } from '../../icons';
import { soundManager } from '../../soundManager';

interface CompletedScreenProps {
  playerName: string;
  score: number;
  totalStars: number;
  historyLength: number;
  onRestartClick: () => void;
  onSaveExitClick: () => void;
}

/**
 * CompletedScreen component - Renders the game completion screen with stats
 * Pure extraction from main.ts renderCompletedScreen method
 */
export class CompletedScreen {
  private container: HTMLElement;
  private props: CompletedScreenProps;

  constructor(container: HTMLElement, props: CompletedScreenProps) {
    this.container = container;
    this.props = props;
  }

  /**
   * Render the completed screen
   */
  render(): void {
    const maxPossibleStars = this.props.historyLength * 3;

    this.container.innerHTML = `
      <div class="completed-scene-card arcade-card text-center animate-fade-in" style="padding: 38px 28px; max-width: 580px; width: 92%; margin: 0 auto; text-align: center;">
        <div style="margin-bottom: 16px; color: #FACC15; display: flex; justify-content: center; filter: drop-shadow(0 4px 16px rgba(250, 204, 21, 0.65));">
          ${Icons.trophy(76)}
        </div>
        <h2 style="font-family: var(--font-primary); font-size: 34px; font-weight: 800; color: #FFFFFF; text-shadow: 0 3px 8px rgba(0, 0, 0, 0.6); letter-spacing: 0.5px; margin: 0 0 10px 0;">
          Vocab Quest Completed!
        </h2>
        <p style="font-size: 20px; font-weight: 700; color: #FFFFFF; text-shadow: 0 2px 6px rgba(0, 0, 0, 0.7); margin: 0 0 24px 0; line-height: 1.55;">
          Congratulations, <span style="color: #FDE047; font-weight: 800; text-shadow: 0 0 14px rgba(253, 224, 71, 0.7);">${this.props.playerName || 'Adventurer'}</span>! You conquered all 3 Kingdoms across the 2D Prosperidad Map.
        </p>

        <div style="margin: 0 0 26px 0; background: rgba(15, 23, 42, 0.92); border: 2.5px solid #38BDF8; border-radius: 20px; padding: 18px 24px; display: flex; justify-content: space-around; align-items: center; box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.45);">
          <div>
            <span style="font-size: 13px; font-weight: 800; color: #BAE6FD; text-transform: uppercase; letter-spacing: 1.2px; display: block; margin-bottom: 4px;">Final Score</span>
            <h1 style="font-family: var(--font-primary); font-size: 38px; font-weight: 800; color: #F59E0B; margin: 0; text-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);">
              ${this.props.score} <span style="font-size: 20px; font-weight: 700; color: #FDE68A;">pts</span>
            </h1>
          </div>
          <div style="width: 2px; height: 52px; background: rgba(56, 189, 248, 0.3); border-radius: 1px;"></div>
          <div>
            <span style="font-size: 13px; font-weight: 800; color: #BAE6FD; text-transform: uppercase; letter-spacing: 1.2px; display: block; margin-bottom: 4px;">Stars Earned</span>
            <h1 style="font-family: var(--font-primary); font-size: 38px; font-weight: 800; color: #FDE047; margin: 0; display: flex; align-items: center; justify-content: center; gap: 8px; text-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);">
              <span style="color: #FACC15; filter: drop-shadow(0 2px 8px rgba(250, 204, 21, 0.7));">${Icons.star(28)}</span>
              ${this.props.totalStars}/${maxPossibleStars || 9}
            </h1>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 14px; max-width: 360px; margin: 0 auto; width: 100%;">
          <div id="completedRestartBtnFrame" class="vocab-btn-frame">
            <button id="completedRestartBtn" class="vocab-btn vocab-btn-green" style="height: 58px; font-size: 22px;">
              <span>${Icons.refresh(22)}</span>
              <span>PLAY AGAIN</span>
            </button>
          </div>

          <div id="completedSaveExitBtnFrame" class="vocab-btn-frame vocab-btn-frame-blue">
            <button id="completedSaveExitBtn" class="vocab-btn vocab-btn-blue" style="height: 58px; font-size: 22px;">
              <span>${Icons.check(22)}</span>
              <span>SAVE & EXIT</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    document.getElementById('completedRestartBtnFrame')?.addEventListener('mouseenter', () => soundManager.playHover());
    document.getElementById('completedRestartBtn')?.addEventListener('click', () => {
      soundManager.playClick();
      soundManager.stopSpeech();
      this.props.onRestartClick();
    });

    document.getElementById('completedSaveExitBtnFrame')?.addEventListener('mouseenter', () => soundManager.playHover());
    document.getElementById('completedSaveExitBtn')?.addEventListener('click', () => {
      soundManager.playClick();
      soundManager.stopSpeech();
      this.props.onSaveExitClick();
    });
  }

  /**
   * Update props and re-render
   */
  updateProps(newProps: Partial<CompletedScreenProps>): void {
    this.props = { ...this.props, ...newProps };
    this.render();
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    // Event listeners are automatically cleaned up when innerHTML is replaced
  }
}
