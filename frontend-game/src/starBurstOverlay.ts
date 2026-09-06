import { soundManager } from './soundManager';

const STAR_STAGGER_MS = 500;
const STAR_ANIM_MS = 450;
const VIEW_DURATION_MS = 500; // Extra time to view earned stars before closing

function starSvgHtml(): string {
  const sizeValue = 90;
  return `<svg class="star-burst-svg" viewBox="0 0 36 36" width="${sizeValue}" height="${sizeValue}">
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
  const sizeValue = 90;
  return `<svg class="star-burst-svg" viewBox="0 0 36 36" width="${sizeValue}" height="${sizeValue}">
    <path d="M 18,2 L 22.5,12.5 L 34,14 L 25.5,22 L 28,33.5 L 18,27.5 L 8,33.5 L 10.5,22 L 2,14 L 13.5,12.5 Z"
          fill="rgba(100, 100, 100, 0.3)" />
  </svg>`;
}

/**
 * Shows a Candy Crush-style sequential star burst overlay.
 * Returns a promise that resolves when all earned stars have animated.
 */
export function showStarBurstOverlay(starsEarned: number, globalLevel: number): Promise<void> {
  return new Promise((resolve) => {
    const count = Math.max(1, Math.min(3, starsEarned));

    let overlay = document.getElementById('starBurstOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'starBurstOverlay';
      overlay.className = 'star-burst-overlay';
      document.body.appendChild(overlay);
    }

    // Start with all slots empty (gray star shapes)
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
        <div class="star-burst-particles"></div>
      </div>
    `;

    overlay.classList.add('visible');

    const totalDuration = (count - 1) * STAR_STAGGER_MS + STAR_ANIM_MS + VIEW_DURATION_MS + 400;

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

    setTimeout(() => {
      overlay?.classList.remove('visible');
      setTimeout(() => {
        overlay?.remove();
        resolve();
      }, 300);
    }, totalDuration);
  });
}
