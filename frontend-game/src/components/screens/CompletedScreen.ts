import { Icons } from '../../icons';
import { soundManager } from '../../soundManager';

export interface KingdomResult {
  /** Kingdom number 1..3 */
  id: number;
  stars: number;
  maxStars: number;
}

interface CompletedScreenProps {
  playerName: string;
  score: number;
  totalStars: number;
  historyLength: number;
  /** Stars per kingdom (shown as the three kingdom flags). */
  kingdoms?: KingdomResult[];
  onRestartClick: () => void;
  onSaveExitClick: () => void;
}

const KINGDOM_INFO: Record<number, { name: string; color: string; dark: string }> = {
  1: { name: 'EPCES', color: '#22C55E', dark: '#15803D' },
  2: { name: 'Bayan ng Prosperidad', color: '#F59E0B', dark: '#B45309' },
  3: { name: 'Provincial Capitol', color: '#8B5CF6', dark: '#6D28D9' },
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/**
 * The scene behind the card: the game's map drawn in plain SVG (sky, clouds, hills, the brick road
 * winding up past the three kingdom flags, trees). No pictures to download; light on phones.
 */
function sceneSvg(): string {
  return `
  <svg class="vq-finish-svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <linearGradient id="vqfSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#38BDF8"/>
        <stop offset="0.55" stop-color="#9BDCFB"/>
        <stop offset="1" stop-color="#DDF3FE"/>
      </linearGradient>
      <linearGradient id="vqfHillFar" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#86C95A"/><stop offset="1" stop-color="#5FAF3E"/>
      </linearGradient>
      <linearGradient id="vqfHillNear" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5DBB45"/><stop offset="1" stop-color="#2F8F2E"/>
      </linearGradient>
      <pattern id="vqfBrick" width="22" height="12" patternUnits="userSpaceOnUse">
        <rect width="22" height="12" fill="#C2552F"/>
        <path d="M0 6H22M11 0V6M0 6V12M22 6V12" stroke="#9A3D20" stroke-width="1.6"/>
      </pattern>
    </defs>
    <rect width="1200" height="800" fill="url(#vqfSky)"/>
    <circle cx="1030" cy="120" r="70" fill="#FEF3C7" opacity="0.9"/>
    <circle cx="1030" cy="120" r="48" fill="#FDE68A"/>
    <g fill="#FFFFFF" opacity="0.95">
      <g class="vq-finish-cloud c1"><ellipse cx="180" cy="130" rx="80" ry="26"/><ellipse cx="225" cy="112" rx="48" ry="30"/><ellipse cx="140" cy="118" rx="40" ry="22"/></g>
      <g class="vq-finish-cloud c2"><ellipse cx="640" cy="90" rx="70" ry="22"/><ellipse cx="680" cy="74" rx="42" ry="26"/></g>
      <g class="vq-finish-cloud c3"><ellipse cx="900" cy="220" rx="60" ry="18"/><ellipse cx="930" cy="206" rx="34" ry="20"/></g>
    </g>
    <path d="M0 470 Q 200 380 420 440 T 820 420 T 1200 430 V800 H0Z" fill="url(#vqfHillFar)"/>
    <path d="M0 560 Q 260 470 560 540 T 1200 520 V800 H0Z" fill="url(#vqfHillNear)"/>
    <!-- brick road with stone curbs, from the front up the hills -->
    <path d="M520 800 C 520 700, 820 690, 760 610 S 420 560, 520 500 S 820 450, 760 410" fill="none" stroke="#E7E1D3" stroke-width="86" stroke-linecap="round"/>
    <path d="M520 800 C 520 700, 820 690, 760 610 S 420 560, 520 500 S 820 450, 760 410" fill="none" stroke="url(#vqfBrick)" stroke-width="70" stroke-linecap="round"/>
    <!-- kingdom flags along the road -->
    <g class="vq-finish-flag"><rect x="402" y="560" width="6" height="70" fill="#7C4A21"/><path d="M408 562 L458 576 L408 592Z" fill="#22C55E"/><circle cx="405" cy="560" r="5" fill="#FACC15"/></g>
    <g class="vq-finish-flag"><rect x="842" y="452" width="6" height="64" fill="#7C4A21"/><path d="M848 454 L896 467 L848 481Z" fill="#F59E0B"/><circle cx="845" cy="452" r="5" fill="#FACC15"/></g>
    <g class="vq-finish-flag"><rect x="690" y="356" width="6" height="58" fill="#7C4A21"/><path d="M696 358 L740 370 L696 382Z" fill="#8B5CF6"/><circle cx="693" cy="356" r="5" fill="#FACC15"/></g>
    <!-- low-poly trees, palms and bushes like the 3D map -->
    <g>
      <g transform="translate(110 600)"><rect x="-6" y="0" width="12" height="40" fill="#7C4A21"/><path d="M0 -90 L-46 10 H46Z" fill="#15803D"/><path d="M0 -90 L0 10 H46Z" fill="#166534"/></g>
      <g transform="translate(230 640) scale(0.8)"><rect x="-6" y="0" width="12" height="40" fill="#7C4A21"/><path d="M0 -90 L-46 10 H46Z" fill="#16A34A"/><path d="M0 -90 L0 10 H46Z" fill="#15803D"/></g>
      <g transform="translate(1080 610)"><rect x="-6" y="0" width="12" height="40" fill="#7C4A21"/><path d="M0 -90 L-46 10 H46Z" fill="#15803D"/><path d="M0 -90 L0 10 H46Z" fill="#166534"/></g>
      <g transform="translate(980 680) scale(0.7)"><rect x="-6" y="0" width="12" height="40" fill="#7C4A21"/><path d="M0 -90 L-46 10 H46Z" fill="#16A34A"/><path d="M0 -90 L0 10 H46Z" fill="#15803D"/></g>
      <g transform="translate(300 470) scale(0.55)"><rect x="-6" y="0" width="12" height="40" fill="#7C4A21"/><path d="M0 -90 L-46 10 H46Z" fill="#4D9A35"/></g>
      <g transform="translate(1010 450) scale(0.5)"><rect x="-6" y="0" width="12" height="40" fill="#7C4A21"/><path d="M0 -90 L-46 10 H46Z" fill="#4D9A35"/></g>
      <g transform="translate(60 720)"><path d="M0 0 Q -4 -70 10 -120" stroke="#8B5A2B" stroke-width="9" fill="none"/><g fill="#22A447"><path d="M10 -120 Q -40 -130 -70 -95 Q -30 -110 10 -116Z"/><path d="M10 -120 Q 60 -135 90 -100 Q 50 -112 10 -116Z"/><path d="M10 -120 Q -10 -165 -45 -170 Q -5 -150 8 -118Z"/><path d="M10 -120 Q 35 -165 70 -160 Q 30 -148 12 -118Z"/></g></g>
      <g transform="translate(1150 760) scale(0.9)"><path d="M0 0 Q 4 -70 -10 -120" stroke="#8B5A2B" stroke-width="9" fill="none"/><g fill="#22A447"><path d="M-10 -120 Q 40 -130 70 -95 Q 30 -110 -10 -116Z"/><path d="M-10 -120 Q -60 -135 -90 -100 Q -50 -112 -10 -116Z"/><path d="M-10 -120 Q 10 -165 45 -170 Q 5 -150 -8 -118Z"/></g></g>
      <ellipse cx="330" cy="760" rx="70" ry="34" fill="#2F8F2E"/><ellipse cx="300" cy="750" rx="40" ry="26" fill="#3FA63A"/>
      <ellipse cx="900" cy="770" rx="80" ry="36" fill="#2F8F2E"/><ellipse cx="930" cy="756" rx="44" ry="28" fill="#3FA63A"/>
      <g fill="#F43F5E"><circle cx="290" cy="742" r="5"/><circle cx="318" cy="736" r="4"/><circle cx="920" cy="748" r="5"/></g>
      <g fill="#FDE047"><circle cx="350" cy="748" r="4"/><circle cx="890" cy="756" r="4"/></g>
    </g>
  </svg>`;
}

/** Confetti pieces: a few small spans moved with transform only (cheap on phones). */
function confettiHtml(): string {
  const colors = ['#FACC15', '#22C55E', '#38BDF8', '#F43F5E', '#A78BFA', '#FB923C'];
  let html = '';
  for (let i = 0; i < 18; i++) {
    const left = (i * 53) % 100;
    const delay = ((i * 37) % 26) / 10;
    const dur = 3.8 + ((i * 17) % 20) / 10;
    const c = colors[i % colors.length];
    html += `<span style="left:${left}%;background:${c};animation-delay:-${delay}s;animation-duration:${dur}s"></span>`;
  }
  return `<div class="vq-finish-confetti" aria-hidden="true">${html}</div>`;
}

function starsRow(stars: number, max: number): string {
  // three big stars that fill by the share of stars earned in that kingdom
  const share = max > 0 ? stars / max : 0;
  const filled = share >= 0.95 ? 3 : share >= 0.6 ? 2 : share > 0 ? 1 : 0;
  let s = '';
  for (let i = 0; i < 3; i++) s += `<span class="${i < filled ? 'on' : ''}">★</span>`;
  return s;
}

/**
 * CompletedScreen: shown after the last level of the last kingdom.
 * A celebration over a drawing of the game map, the player's student, score, stars per kingdom.
 */
export class CompletedScreen {
  private container: HTMLElement;
  private props: CompletedScreenProps;

  constructor(container: HTMLElement, props: CompletedScreenProps) {
    this.container = container;
    this.props = props;
  }

  render(): void {
    const maxPossibleStars = this.props.historyLength * 3;
    const name = escapeHtml(this.props.playerName || 'Adventurer');
    const kingdoms = (this.props.kingdoms && this.props.kingdoms.length ? this.props.kingdoms : [1, 2, 3].map((id) => ({ id, stars: 0, maxStars: 0 })));

    this.container.innerHTML = `
      <div class="vq-finish-scene" role="presentation">
        ${sceneSvg()}
        ${confettiHtml()}
      </div>
      <div class="vq-finish-wrap">
        <div class="completed-scene-card vq-finish-card">
          <div class="vq-finish-hero">
            <div class="vq-finish-glow"></div>
            <div class="vq-finish-trophy">${Icons.trophy(64)}</div>
          </div>
          <div class="vq-finish-ribbon"><span>QUEST COMPLETE!</span></div>
          <p class="vq-finish-msg">
            Great job, <b>${name}</b>! You finished all 3 kingdoms.
          </p>

          <div class="vq-finish-stats">
            <div class="vq-finish-stat">
              <span class="lbl">Score</span>
              <span class="val score">${this.props.score}<small>pts</small></span>
            </div>
            ${
              maxPossibleStars > 0
                ? `<div class="vq-finish-stat">
              <span class="lbl">Stars</span>
              <span class="val stars"><i>${Icons.star(24)}</i>${this.props.totalStars}<small>/${maxPossibleStars}</small></span>
            </div>`
                : `<div class="vq-finish-stat">
              <span class="lbl">Kingdoms</span>
              <span class="val stars"><i>${Icons.star(24)}</i>3<small>/3</small></span>
            </div>`
            }
          </div>

          <div class="vq-finish-kingdoms">
            ${kingdoms
              .map((k) => {
                const info = KINGDOM_INFO[k.id] ?? KINGDOM_INFO[1];
                return `
              <div class="vq-finish-kingdom" style="--kc:${info.color};--kd:${info.dark}">
                <div class="flag">${k.id}</div>
                <div class="kname">${info.name}</div>
                <div class="kstars">${k.maxStars > 0 ? starsRow(k.stars, k.maxStars) : '<span class="done">✔ Done</span>'}</div>
              </div>`;
              })
              .join('')}
          </div>

          <div class="vq-finish-actions">
            <div id="completedRestartBtnFrame" class="vocab-btn-frame">
              <button id="completedRestartBtn" class="vocab-btn vocab-btn-green">
                <span>${Icons.refresh(22)}</span>
                <span>PLAY AGAIN</span>
              </button>
            </div>
            <div id="completedSaveExitBtnFrame" class="vocab-btn-frame vocab-btn-frame-blue">
              <button id="completedSaveExitBtn" class="vocab-btn vocab-btn-blue">
                <span>${Icons.check(22)}</span>
                <span>SAVE & EXIT</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

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

  updateProps(newProps: Partial<CompletedScreenProps>): void {
    this.props = { ...this.props, ...newProps };
    this.render();
  }

  destroy(): void {
    // Event listeners are automatically cleaned up when innerHTML is replaced
  }
}
