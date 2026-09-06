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
      <div class="arcade-card text-center animate-fade-in" style="padding: 40px 28px; max-width: 580px; margin: 0 auto; text-align: center;">
        <div style="margin-bottom: 16px; color: #FACC15; display: flex; justify-content: center;">
          ${Icons.trophy(72)}
        </div>
        <h2 style="font-family: var(--font-primary); font-size: 32px; font-weight: 700; color: #FAFAFA;">
          Vocab Quest Completed!
        </h2>
        <p style="font-size: 18px; font-weight: 400; color: #94A3B8; margin-top: 6px;">
          Congratulations, <strong>${this.props.playerName}</strong>! You conquered all 3 Kingdoms across the 2D Prosperidad Map.
        </p>

        <div style="margin: 24px 0; background: #0F172A; border: 2px solid #334155; border-radius: 18px; padding: 20px; display: flex; justify-content: space-around; align-items: center;">
          <div>
            <span style="font-size: 14px; font-weight: 600; color: #94A3B8; text-transform: uppercase;">Final Score</span>
            <h1 style="font-family: var(--font-primary); font-size: 36px; font-weight: 700; color: #F59E0B; margin-top: 4px;">
              ${this.props.score} pts
            </h1>
          </div>
          <div>
            <span style="font-size: 14px; font-weight: 600; color: #94A3B8; text-transform: uppercase;">Stars Earned</span>
            <h1 style="font-family: var(--font-primary); font-size: 36px; font-weight: 700; color: #FDE047; margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              ${Icons.star(28)} ${this.props.totalStars}/${maxPossibleStars || 9}
            </h1>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 14px; max-width: 360px; margin: 0 auto;">
          <div id="completedRestartBtnFrame" class="vocab-btn-frame">
            <button id="completedRestartBtn" class="vocab-btn vocab-btn-green" style="height: 58px; font-size: 24px;">
              <span>${Icons.refresh(22)}</span>
              <span>PLAY AGAIN</span>
            </button>
          </div>

          <div id="completedSaveExitBtnFrame" class="vocab-btn-frame vocab-btn-frame-blue">
            <button id="completedSaveExitBtn" class="vocab-btn vocab-btn-blue" style="height: 58px; font-size: 24px;">
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
