import { KINGDOM_DIALOGUES, GLOBAL_INTRO_DIALOGUE } from '../../dialogueData';

interface DialogueSlide {
  speaker: string;
  titleBadge: string;
  text: string;
  buttonText?: string;
  characterImage?: string;
}

interface DialogueData {
  slides: DialogueSlide[];
}

interface DialogueOverlayProps {
  isOpen: boolean;
  dialogueType: 'global' | 'kingdom';
  dialogueKingdomId: number;
  dialogueSlideIndex: number;
  playerName: string;
  onNextSlide: () => void;
  onPrevSlide: () => void;
  onClose: () => void;
}

/**
 * DialogueOverlay component - Renders the interactive kingdom tutorial and story dialogue overlay
 * Pure extraction from main.ts renderDialogueOverlay method
 */
export class DialogueOverlay {
  private props: DialogueOverlayProps;
  private container: HTMLElement | null = null;

  constructor(props: DialogueOverlayProps) {
    this.props = props;
  }

  /**
   * Get the active dialogue data
   */
  private getActiveDialogue(): DialogueData {
    if (this.props.dialogueType === 'global') {
      return GLOBAL_INTRO_DIALOGUE;
    }
    return KINGDOM_DIALOGUES[this.props.dialogueKingdomId] || KINGDOM_DIALOGUES[1];
  }

  /**
   * Render the dialogue overlay
   */
  render(): void {
    const OVERLAY_ID = 'dialogueOverlayContainer';
    const existing = document.getElementById(OVERLAY_ID);

    if (!this.props.isOpen) {
      if (existing) existing.remove();
      return;
    }

    const kd = this.getActiveDialogue();
    const slide = kd.slides[this.props.dialogueSlideIndex] || kd.slides[0];
    const isFinalSlide = this.props.dialogueSlideIndex >= kd.slides.length - 1;
    const hasPrev = this.props.dialogueSlideIndex > 0;

    const formattedText = slide.text.replace(
      '{playerName}',
      `<span class="dialogue-name-highlight">${this.props.playerName || 'Adventurer'}</span>`
    );

    const dotsHtml = kd.slides
      .map((_, i) => `<div class="dialogue-dot ${i === this.props.dialogueSlideIndex ? 'active' : ''}"></div>`)
      .join('');

    const prevBtnHtml = hasPrev
      ? `<button id="dialoguePrevBtn" class="dialogue-btn-prev"><span>◀ PREV</span></button>`
      : '';

    // If overlay is already in the DOM, update in-place without tearing down backdrop (prevents screen blinking!)
    if (existing) {
      this.updateInPlace(existing, slide, formattedText, dotsHtml, prevBtnHtml, isFinalSlide);
      return;
    }

    // Initial render
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'dialogue-overlay-backdrop';

    const charHtml = slide.characterImage
      ? `<div class="dialogue-char-stage">
           <img class="dialogue-char-img" src="${slide.characterImage}" alt="${slide.speaker}" />
           <div class="dialogue-char-ground-shadow"></div>
         </div>`
      : '';

    overlay.innerHTML = `
      <div class="dialogue-wrapper ${slide.characterImage ? 'has-character' : 'full-dialogue'}">
        <div class="dialogue-card">
          <div class="dialogue-header">
            <div class="dialogue-speaker-tag">
              <span class="dialogue-speaker-name">${slide.speaker}</span>
            </div>
            <div class="dialogue-badge-sub">${slide.titleBadge}</div>
            <button id="dialogueSkipBtn" class="dialogue-skip-btn">Skip ❯❯</button>
          </div>

          <div class="dialogue-body">
            <div class="dialogue-speech-text">${formattedText}</div>
          </div>

          <div class="dialogue-footer">
            <div class="dialogue-step-dots">
              ${dotsHtml}
            </div>
            <div class="dialogue-footer-actions">
              ${prevBtnHtml}
              <button id="dialogueActionBtn" class="dialogue-btn-action">
                <span>${slide.buttonText || (isFinalSlide ? 'START QUEST ⚔️' : 'NEXT ▶')}</span>
              </button>
            </div>
          </div>
        </div>
        ${charHtml}
      </div>
    `;

    document.body.appendChild(overlay);
    this.container = overlay;

    this.attachEventListeners(overlay);
  }

  /**
   * Update existing overlay in-place
   */
  private updateInPlace(
    existing: HTMLElement,
    slide: DialogueSlide,
    formattedText: string,
    dotsHtml: string,
    prevBtnHtml: string,
    isFinalSlide: boolean
  ): void {
    const speakerEl = existing.querySelector('.dialogue-speaker-name');
    if (speakerEl) speakerEl.textContent = slide.speaker;

    const badgeEl = existing.querySelector('.dialogue-badge-sub');
    if (badgeEl) badgeEl.textContent = slide.titleBadge;

    const textEl = existing.querySelector('.dialogue-speech-text');
    if (textEl) textEl.innerHTML = formattedText;

    const dotsContainer = existing.querySelector('.dialogue-step-dots');
    if (dotsContainer) dotsContainer.innerHTML = dotsHtml;

    const actionBtn = existing.querySelector('#dialogueActionBtn span');
    if (actionBtn) actionBtn.textContent = slide.buttonText || (isFinalSlide ? 'START QUEST ⚔️' : 'NEXT ▶');

    const actionsContainer = existing.querySelector('.dialogue-footer-actions');
    if (actionsContainer) {
      actionsContainer.innerHTML = `
        ${prevBtnHtml}
        <button id="dialogueActionBtn" class="dialogue-btn-action">
          <span>${slide.buttonText || (isFinalSlide ? 'START QUEST ⚔️' : 'NEXT ▶')}</span>
        </button>
      `;
      existing.querySelector('#dialoguePrevBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.props.onPrevSlide();
      });
      existing.querySelector('#dialogueActionBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.props.onNextSlide();
      });
    }

    const charImg = existing.querySelector<HTMLImageElement>('.dialogue-char-img');
    if (charImg && slide.characterImage) {
      charImg.src = slide.characterImage;
    }
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(overlay: HTMLElement): void {
    overlay.querySelector('#dialoguePrevBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.props.onPrevSlide();
    });

    overlay.querySelector('#dialogueActionBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.props.onNextSlide();
    });

    overlay.querySelector('#dialogueSkipBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.props.onClose();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.props.onNextSlide();
      }
    });
  }

  /**
   * Remove the overlay from the DOM
   */
  destroy(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
