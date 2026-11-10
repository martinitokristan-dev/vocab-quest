import { KINGDOM_DIALOGUES, GLOBAL_INTRO_DIALOGUE, type DialogueSlide } from '../../dialogueData';
import { soundManager } from '../../soundManager';
import { Icons } from '../../icons';

interface DialogueData {
  slides: DialogueSlide[];
}

interface DialogueOverlayProps {
  isOpen: boolean;
  dialogueType: 'global' | 'kingdom';
  dialogueKingdomId: number;
  dialogueSlideIndex: number;
  playerName: string;
  /** SKIP: jump to the last slide (it holds the CONTINUE / BEGIN button). */
  onSkip: () => void;
  /** CONTINUE / BEGIN on the last slide: close the dialogue. */
  onBegin: () => void;
  /** LISTEN: replay this slide's voice (main.ts knows where a shared recording's part starts). */
  onListen?: () => void;
}

/** One tap per 400 ms: a double tap on SKIP must not also hit BEGIN, which appears in the same spot. */
const TAP_LOCK_MS = 400;
let lastTapAt = 0;

function tapAllowed(): boolean {
  const now = Date.now();
  if (now - lastTapAt < TAP_LOCK_MS) return false;
  lastTapAt = now;
  return true;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/**
 * Teacher guide dialogue (welcome + kingdom intros).
 * No PREV / NEXT: the teacher's voice turns the slides (main.ts syncDialogueAudio), like a game cutscene.
 * Footer: blue LISTEN (replay this slide) + orange SKIP (jump to the last slide);
 * on the last slide SKIP is replaced, in the same spot, by the green CONTINUE / BEGIN button.
 */
export class DialogueOverlay {
  private props: DialogueOverlayProps;
  private container: HTMLElement | null = null;

  constructor(props: DialogueOverlayProps) {
    this.props = props;
  }

  private getActiveDialogue(): DialogueData {
    if (this.props.dialogueType === 'global') {
      return GLOBAL_INTRO_DIALOGUE;
    }
    return KINGDOM_DIALOGUES[this.props.dialogueKingdomId] || KINGDOM_DIALOGUES[1];
  }

  private dotsHtml(count: number, active: number): string {
    return Array.from({ length: count }, (_, i) => {
      const cls = i === active ? 'active' : i < active ? 'done' : '';
      return `<div class="dialogue-dot ${cls}">${i === active ? '<span class="dialogue-dot-fill"></span>' : ''}</div>`;
    }).join('');
  }

  private actionsHtml(slide: DialogueSlide, isFinalSlide: boolean): string {
    const listen = slide.audioUrl
      ? `<button id="dialogueAudioBtn" type="button" class="dialogue-btn dialogue-btn-listen" aria-label="Listen again">
           <span class="dialogue-btn-icon">${Icons.volume(22)}</span><span>LISTEN</span>
         </button>`
      : '';
    if (!isFinalSlide) {
      return `${listen}
        <button id="dialogueSkipBtn" type="button" class="dialogue-btn dialogue-btn-skip" aria-label="Skip to the last slide">
          <span class="dialogue-btn-icon">${Icons.skipForward(20)}</span><span>SKIP</span>
        </button>`;
    }
    const icon = Icons[slide.buttonIcon ?? 'arrowRight'](22);
    return `${listen}
      <button id="dialogueBeginBtn" type="button" class="dialogue-btn dialogue-btn-begin">
        <span class="dialogue-btn-icon">${icon}</span><span>${escapeHtml(slide.buttonText || 'CONTINUE')}</span>
      </button>`;
  }

  render(): void {
    const OVERLAY_ID = 'dialogueOverlayContainer';
    const existing = document.getElementById(OVERLAY_ID);

    if (!this.props.isOpen) {
      if (existing) existing.remove();
      return;
    }

    const kd = this.getActiveDialogue();
    const idx = Math.min(this.props.dialogueSlideIndex, kd.slides.length - 1);
    const slide = kd.slides[idx] || kd.slides[0];
    const isFinalSlide = idx >= kd.slides.length - 1;

    const formattedText = escapeHtml(slide.text).replace(
      '{playerName}',
      `<span class="dialogue-name-highlight">${escapeHtml(this.props.playerName || 'Adventurer')}</span>`
    );
    const dotsHtml = this.dotsHtml(kd.slides.length, idx);
    const actionsHtml = this.actionsHtml(slide, isFinalSlide);
    const stepLabel = `Slide ${idx + 1} of ${kd.slides.length}`;

    // Already open: update in place (keeps the backdrop, so the screen does not blink)
    if (existing) {
      this.container = existing;
      const speakerEl = existing.querySelector('.dialogue-speaker-name');
      if (speakerEl) speakerEl.textContent = slide.speaker;
      const badgeEl = existing.querySelector('.dialogue-badge-sub');
      if (badgeEl) badgeEl.textContent = slide.titleBadge;
      const textEl = existing.querySelector<HTMLElement>('.dialogue-speech-text');
      if (textEl && textEl.dataset.slide !== `${idx}`) {
        textEl.innerHTML = formattedText;
        textEl.dataset.slide = `${idx}`;
        // replay the small text entrance on every new slide
        textEl.style.animation = 'none';
        void textEl.offsetWidth;
        textEl.style.animation = '';
      }
      const dots = existing.querySelector('.dialogue-step-dots');
      if (dots) {
        dots.innerHTML = dotsHtml;
        dots.setAttribute('aria-label', stepLabel);
      }
      const actions = existing.querySelector<HTMLElement>('.dialogue-footer-actions');
      if (actions) {
        actions.innerHTML = actionsHtml;
        actions.classList.toggle('is-final', isFinalSlide);
        this.attachButtonListeners(actions);
      }
      const charImg = existing.querySelector<HTMLImageElement>('.dialogue-char-img');
      if (charImg && slide.characterImage && charImg.getAttribute('src') !== slide.characterImage) {
        charImg.src = slide.characterImage;
      }
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'dialogue-overlay-backdrop';

    const charHtml = slide.characterImage
      ? `<div class="dialogue-char-stage">
           <img class="dialogue-char-img" src="${slide.characterImage}" alt="${escapeHtml(slide.speaker)}" />
           <div class="dialogue-char-ground-shadow"></div>
         </div>`
      : '';

    overlay.innerHTML = `
      <div class="dialogue-wrapper ${slide.characterImage ? 'has-character' : 'full-dialogue'}">
        <div class="dialogue-card" role="dialog" aria-modal="true">
          <div class="dialogue-header">
            <div class="dialogue-speaker-tag">
              <span class="dialogue-speaker-name">${escapeHtml(slide.speaker)}</span>
            </div>
            <div class="dialogue-badge-sub">${escapeHtml(slide.titleBadge)}</div>
          </div>

          <div class="dialogue-body">
            <div class="dialogue-speech-text" data-slide="${idx}">${formattedText}</div>
          </div>

          <div class="dialogue-footer">
            <div class="dialogue-step-dots" aria-label="${stepLabel}">${dotsHtml}</div>
            <div class="dialogue-footer-actions ${isFinalSlide ? 'is-final' : ''}">${actionsHtml}</div>
          </div>
        </div>
        ${charHtml}
      </div>
    `;

    document.body.appendChild(overlay);
    this.container = overlay;

    this.attachButtonListeners(overlay);
    // A tap anywhere only unlocks sound (browsers block autoplay until the first tap); it never turns
    // a slide, so a kid who taps the screen by accident does not miss part of the guide.
    overlay.addEventListener('click', () => soundManager.resumeOnUserGesture());
  }

  private attachButtonListeners(root: HTMLElement): void {
    root.querySelector('#dialogueAudioBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      soundManager.resumeOnUserGesture();
      if (!tapAllowed()) return;
      if (this.props.onListen) {
        this.props.onListen();
        return;
      }
      const kd = this.getActiveDialogue();
      const slide = kd.slides[this.props.dialogueSlideIndex] || kd.slides[0];
      if (slide?.audioUrl) soundManager.playDialogueAudio(slide.audioUrl);
    });

    root.querySelector('#dialogueSkipBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      soundManager.resumeOnUserGesture();
      if (!tapAllowed()) return;
      this.props.onSkip();
    });

    root.querySelector('#dialogueBeginBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      soundManager.resumeOnUserGesture();
      if (!tapAllowed()) return;
      this.props.onBegin();
    });
  }

  /** Fills the current slide's dot like a progress bar (0..1) while the voice reads that slide. */
  setProgress(fraction: number): void {
    const el = (this.container || document.getElementById('dialogueOverlayContainer'))
      ?.querySelector<HTMLElement>('.dialogue-dot.active .dialogue-dot-fill');
    if (el) el.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
  }

  /** Last slide: the voice has finished, so the CONTINUE / BEGIN button starts a gentle pulse. */
  setReady(ready: boolean): void {
    const el = (this.container || document.getElementById('dialogueOverlayContainer'))
      ?.querySelector<HTMLElement>('#dialogueBeginBtn');
    el?.classList.toggle('is-ready', ready);
  }

  destroy(): void {
    const el = this.container || document.getElementById('dialogueOverlayContainer');
    if (el) {
      el.remove();
    }
    this.container = null;
  }
}
