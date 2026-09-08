import { Icons } from '../../icons';
import { soundManager } from '../../soundManager';

interface HowToPlayModalProps {
  onClose: () => void;
}

/**
 * HowToPlayModal component - Renders the How To Play instructions modal
 * Pure extraction from main.ts renderModals method
 */
export class HowToPlayModal {
  private container: HTMLElement;
  private props: HowToPlayModalProps;

  constructor(props: HowToPlayModalProps) {
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
      <div class="modal-dialog modal-voxel-box" style="max-width: 720px; width: 92vw; padding: 30px 36px;">
        <div class="modal-header">
          <div class="modal-title minecraft-gold-title" style="font-family: var(--font-primary); font-size: 26px; font-weight: 700;">
            HOW TO PLAY VOCAB QUEST
          </div>
          <button id="closeHowToPlayBtn" class="modal-close-btn voxel-close-btn" style="width: 40px; height: 40px; font-size: 20px;">✕</button>
        </div>

        <div class="how-to-vertical-list">
          <div class="how-to-step-item">
            <div class="step-badge-box step-badge-1">
              <span>01</span>
            </div>
            <div class="step-info-col">
              <div class="step-title-text" style="font-family: var(--font-primary); font-size: 18px; font-weight: 700;">JOIN GAME ROOM</div>
              <div class="step-desc-text" style="font-size: 16px; font-weight: 400;">Enter your teacher's 6-digit Room PIN and choose your student character.</div>
            </div>
          </div>

          <div class="how-to-step-item">
            <div class="step-badge-box step-badge-2">
              <span>02</span>
            </div>
            <div class="step-info-col">
              <div class="step-title-text" style="font-family: var(--font-primary); font-size: 18px; font-weight: 700;">EXPLORE & ANSWER</div>
              <div class="step-desc-text" style="font-size: 16px; font-weight: 400;">Walk across the Kingdom map nodes and solve contextual vocabulary questions.</div>
            </div>
          </div>

          <div class="how-to-step-item">
            <div class="step-badge-box step-badge-3">
              <span>03</span>
            </div>
            <div class="step-info-col">
              <div class="step-title-text" style="font-family: var(--font-primary); font-size: 18px; font-weight: 700;">LEVEL UP & WIN</div>
              <div class="step-desc-text" style="font-size: 16px; font-weight: 400;">Earn quest points, unlock kingdoms, and top the classroom leaderboard.</div>
            </div>
          </div>
        </div>

        <div id="closeHowToPlayBtnBottomFrame" class="vocab-btn-frame" style="margin-top: 20px; width: 100%;">
          <button id="closeHowToPlayBtnBottom" class="vocab-btn vocab-btn-blue" style="height: clamp(52px, 8vh, 60px); font-size: clamp(17px, 4vw, 22px); width: 100%;">
            <span>${Icons.check(22)}</span>
            <span>GOT IT, LET'S PLAY</span>
          </button>
        </div>
      </div>
    `;

    requestAnimationFrame(() => this.attachEventListeners());
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    const bottomFrame = document.getElementById('closeHowToPlayBtnBottomFrame');
    bottomFrame?.addEventListener('mouseenter', () => soundManager.playHover());

    const closeHowTo = () => {
      soundManager.playClick();
      this.props.onClose();
    };

    document.getElementById('closeHowToPlayBtn')?.addEventListener('click', closeHowTo);
    bottomFrame?.addEventListener('click', closeHowTo);
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
