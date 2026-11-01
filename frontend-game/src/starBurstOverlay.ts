import { soundManager } from './soundManager';

const STAR_START_DELAY_MS = 350; // let the banner pop in first
const STAR_STAGGER_MS = 500;
const STAR_ANIM_MS = 450;

/** Rounded 5-point star centred at (50, 54) in a 100 x 100 box. */
const STAR_PATH =
  'M50 10 L62.93 36.2 L91.85 40.4 L70.92 60.8 L75.86 89.6 L50 76 L24.14 89.6 L29.08 60.8 L8.15 40.4 L37.07 36.2 Z';

function filledStarSvg(): string {
  return `<svg class="lc-star-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="lcStarRim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFB21E" />
        <stop offset="100%" stop-color="#E8590C" />
      </linearGradient>
      <linearGradient id="lcStarBody" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFF6A0" />
        <stop offset="40%" stop-color="#FFD21F" />
        <stop offset="100%" stop-color="#FF9A0A" />
      </linearGradient>
    </defs>
    <path d="${STAR_PATH}" fill="url(#lcStarRim)" stroke="url(#lcStarRim)" stroke-width="10" stroke-linejoin="round" />
    <path d="${STAR_PATH}" transform="translate(50 54) scale(0.8) translate(-50 -54)"
          fill="url(#lcStarBody)" stroke="url(#lcStarBody)" stroke-width="8" stroke-linejoin="round" />
    <ellipse cx="50" cy="40" rx="15" ry="7" fill="rgba(255,255,255,0.6)" />
    <circle cx="50" cy="24" r="3.2" fill="#FFFFFF" />
  </svg>`;
}

function emptyStarSvg(): string {
  return `<svg class="lc-star-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <path d="${STAR_PATH}" fill="rgba(148,163,184,0.35)" stroke="rgba(148,163,184,0.35)" stroke-width="10" stroke-linejoin="round" />
    <path d="${STAR_PATH}" transform="translate(50 54) scale(0.8) translate(-50 -54)"
          fill="#1B2547" stroke="#1B2547" stroke-width="8" stroke-linejoin="round" />
  </svg>`;
}

const ICON_MAP = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path d="M3 6.5 L9 4 L15 6.5 L21 4 V17.5 L15 20 L9 17.5 L3 20 Z" />
  <path d="M9 4 V17.5 M15 6.5 V20" class="lc-icon-line" />
</svg>`;

const ICON_REPLAY = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path d="M20 12a8 8 0 1 1-8-8c2.24 0 4.38.89 5.99 2.44L20 8.5" class="lc-icon-stroke" />
  <path d="M20 3.5v5h-5" class="lc-icon-stroke" />
</svg>`;

const ICON_CONTINUE = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path d="M8 4.5 L19.5 12 L8 19.5 Z" />
</svg>`;

export type StarBurstAction = 'continue' | 'back' | 'replay';

export interface StarBurstResult {
  action: StarBurstAction;
}

/**
 * Level-complete overlay: glossy stars over a green "Level Complete" banner, then three
 * labelled round buttons (MAP / REPLAY / CONTINUE). Labels sit under each icon so younger
 * students who can't read the icons alone still know what each button does.
 */
export function showStarBurstOverlay(starsEarned: number, globalLevel: number): Promise<StarBurstResult> {
  return new Promise<StarBurstResult>((resolve) => {
    const count = Math.max(0, Math.min(3, starsEarned));

    let overlay = document.getElementById('starBurstOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'starBurstOverlay';
      overlay.className = 'star-burst-overlay';
      document.body.appendChild(overlay);
    }

    // 0 stars = the answer was found only on the last remaining choice.
    // Keep it positive (the level is done) but nudge the child to aim for stars next time.
    const isZeroStar = count === 0;
    const bannerText = isZeroStar ? `Level ${globalLevel} Done!` : `Level ${globalLevel} Complete!`;
    const zeroStarMessage = isZeroStar
      ? `<div class="lc-message" role="status">
           <span class="lc-message-main">No stars this time, but you kept going!</span>
           <span class="lc-message-sub">Try to pick the right answer on your first try to earn 3 stars.</span>
         </div>`
      : '';
    const starsLabel = `${count} of 3 stars`;

    overlay.innerHTML = `
      <div class="lc-stage${isZeroStar ? ' lc-zero' : ''}" role="dialog" aria-modal="true" aria-label="${bannerText} ${starsLabel}">
        <div class="lc-rays" aria-hidden="true"></div>
        <div class="lc-glow" aria-hidden="true"></div>
        <div class="lc-sparkles" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span>
        </div>

        <div class="lc-stars">
          ${[1, 2, 3]
            .map(
              (i) => `
            <div class="lc-star lc-star-${i}" data-star="${i}">
              <div class="lc-star-empty">${emptyStarSvg()}</div>
              <div class="lc-star-full">${filledStarSvg()}</div>
            </div>`
            )
            .join('')}
        </div>

        <div class="lc-banner">
          <span class="lc-banner-text">${bannerText}</span>
        </div>

        ${zeroStarMessage}

        <div class="lc-actions" aria-hidden="true">
          <button type="button" class="lc-btn lc-btn-map" id="starBurstBackBtn" aria-label="Back to the map">
            <span class="lc-btn-ring"><span class="lc-btn-core">${ICON_MAP}</span></span>
            <span class="lc-btn-label">MAP</span>
          </button>
          <button type="button" class="lc-btn lc-btn-replay" id="starBurstReplayBtn" aria-label="Replay this level">
            <span class="lc-btn-ring"><span class="lc-btn-core">${ICON_REPLAY}</span></span>
            <span class="lc-btn-label">REPLAY</span>
          </button>
          <button type="button" class="lc-btn lc-btn-continue" id="starBurstContinueBtn" aria-label="Continue to the next level">
            <span class="lc-btn-ring"><span class="lc-btn-core">${ICON_CONTINUE}</span></span>
            <span class="lc-btn-label">CONTINUE</span>
          </button>
        </div>
      </div>
    `;

    overlay.classList.add('visible');

    // Fill earned stars one by one (left → middle → right)
    for (let i = 1; i <= count; i++) {
      setTimeout(() => {
        const slot = overlay?.querySelector(`[data-star="${i}"]`);
        if (slot) {
          slot.classList.add('earned');
          soundManager.playStar(i);
        }
      }, STAR_START_DELAY_MS + (i - 1) * STAR_STAGGER_MS);
    }

    // Reveal the buttons once the stars have landed (space is reserved, so nothing jumps)
    const starsDoneTime =
      count === 0
        ? 900
        : STAR_START_DELAY_MS + (count - 1) * STAR_STAGGER_MS + STAR_ANIM_MS + 100;

    const actionsEl = overlay.querySelector('.lc-actions') as HTMLElement | null;
    let actionsReady = false;
    setTimeout(() => {
      if (!actionsEl) return;
      actionsReady = true;
      actionsEl.classList.add('show');
      actionsEl.setAttribute('aria-hidden', 'false');
      (overlay?.querySelector('#starBurstContinueBtn') as HTMLButtonElement | null)?.focus();
    }, starsDoneTime);

    let isDone = false;
    const finish = (action: StarBurstAction) => {
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
      if (!actionsReady) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        finish('continue');
      } else if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'ArrowLeft') {
        e.preventDefault();
        finish('back');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        finish('replay');
      }
    };
    window.addEventListener('keydown', handleKey);

    const bind = (id: string, action: StarBurstAction) => {
      overlay?.querySelector(id)?.addEventListener('click', (e) => {
        e.stopPropagation();
        finish(action);
      });
    };
    bind('#starBurstBackBtn', 'back');
    bind('#starBurstReplayBtn', 'replay');
    bind('#starBurstContinueBtn', 'continue');
  });
}
