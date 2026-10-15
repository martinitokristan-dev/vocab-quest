import { soundManager } from './soundManager';

const STAR_STAGGER_MS = 500;
const STAR_ANIM_MS = 450;

function starSvgHtml(): string {
  return `<svg class="star-burst-svg" viewBox="0 0 36 36" width="100%" height="100%">
    <defs>
      <linearGradient id="burstStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFF566" />
        <stop offset="35%" stop-color="#FFD000" />
        <stop offset="75%" stop-color="#FF9900" />
        <stop offset="100%" stop-color="#E67300" />
      </linearGradient>
    </defs>
    <path d="M 18,2 L 22.5,12.5 L 34,14 L 25.5,22 L 28,33.5 L 18,27.5 L 8,33.5 L 10.5,22 L 2,14 L 13.5,12.5 Z"
          fill="url(#burstStarGrad)" />
    <ellipse cx="18" cy="11" rx="4.5" ry="2.2" fill="rgba(255,255,255,0.75)" />
  </svg>`;
}

function grayStarSvgHtml(): string {
  return `<svg class="star-burst-svg" viewBox="0 0 36 36" width="100%" height="100%">
    <path d="M 18,2 L 22.5,12.5 L 34,14 L 25.5,22 L 28,33.5 L 18,27.5 L 8,33.5 L 10.5,22 L 2,14 L 13.5,12.5 Z"
          fill="rgba(100, 100, 100, 0.3)" />
  </svg>`;
}

export interface StarBurstResult {
  action: 'continue' | 'back';
}

/**
 * Shows a Candy Crush-style sequential star burst overlay.
 * Waits for the child to choose whether to CONTINUE to the next level or go BACK to the map.
 */
export function showStarBurstOverlay(starsEarned: number, globalLevel: number): Promise<StarBurstResult> {
  return new Promise<StarBurstResult>((resolve) => {
    const count = Math.max(1, Math.min(3, starsEarned));

    let overlay = document.getElementById('starBurstOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'starBurstOverlay';
      overlay.className = 'star-burst-overlay';
      document.body.appendChild(overlay);
    }

    // Start with all slots empty (gray star shapes) and action buttons ready
    overlay.innerHTML = `
      <div class="star-burst-panel animate-pop-up">
        <div class="star-burst-title">LEVEL ${globalLevel} COMPLETE!</div>
        <div class="star-burst-slots">
          ${[1, 2, 3]
            .map(
              (i) =>
                `<div class="star-slot" data-star="${i}">
                  ${grayStarSvgHtml()}
                </div>`
            )
            .join('')}
        </div>
        <div class="star-burst-actions" style="display: none;">
          <button type="button" class="star-burst-btn star-burst-btn-back" id="starBurstBackBtn" title="Back to World Map">
            <span class="star-btn-icon">◀</span>
            <span>BACK</span>
          </button>
          <button type="button" class="star-burst-btn star-burst-btn-continue" id="starBurstContinueBtn" title="Continue to Next Level">
            <span>CONTINUE</span>
            <span class="star-btn-icon">▶</span>
          </button>
        </div>
        <div class="star-burst-particles"></div>
      </div>
    `;

    overlay.classList.add('visible');

    // Sequentially fill each star slot with animation
    for (let i = 1; i <= count; i++) {
      setTimeout(() => {
        const slot = overlay?.querySelector(`[data-star="${i}"]`);
        if (slot) {
          slot.classList.add('active');
          slot.innerHTML = starSvgHtml();
          soundManager.playStar(i);
        }
      }, (i - 1) * STAR_STAGGER_MS);
    }

    // Reveal decision buttons once all stars have burst into view
    const starsDoneTime = (count - 1) * STAR_STAGGER_MS + STAR_ANIM_MS + 100;
    setTimeout(() => {
      const actionsEl = overlay?.querySelector('.star-burst-actions') as HTMLElement | null;
      if (actionsEl) {
        actionsEl.style.display = 'flex';
        actionsEl.classList.add('animate-pop-up');
        const continueBtn = overlay?.querySelector('#starBurstContinueBtn') as HTMLButtonElement | null;
        continueBtn?.focus();
      }
    }, starsDoneTime);

    let isDone = false;
    const finish = (action: 'continue' | 'back') => {
      if (isDone) return;
      isDone = true;
      soundManager.playClick();
      window.removeEventListener('keydown', handleKey);
      overlay?.classList.remove('visible');
      setTimeout(() => {
        overlay?.remove();
        resolve({ action });
      }, 250);
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        finish('continue');
      } else if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'ArrowLeft') {
        e.preventDefault();
        finish('back');
      }
    };
    window.addEventListener('keydown', handleKey);

    const backBtn = overlay.querySelector('#starBurstBackBtn');
    const continueBtn = overlay.querySelector('#starBurstContinueBtn');

    backBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      finish('back');
    });

    continueBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      finish('continue');
    });
  });
}
