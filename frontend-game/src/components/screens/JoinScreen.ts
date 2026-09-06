import { Icons } from '../../icons';
import { soundManager } from '../../soundManager';

const AVATARS = [
  { slug: 'learner-girl', label: 'Learner Girl', image: '/assets/mascot_girl.png' },
  { slug: 'learner-boy', label: 'Learner Boy', image: '/assets/mascot_boy.png' },
  { slug: 'scholar-girl', label: 'School Girl', image: '/assets/scholar_girl.png' },
  { slug: 'scholar-boy', label: 'School Boy', image: '/assets/scholar_boy.png' },
  { slug: 'explorer-girl', label: 'Explorer Girl', image: '/assets/explorer_girl.png' },
  { slug: 'explorer-boy', label: 'Explorer Boy', image: '/assets/explorer_boy.png' },
];

interface JoinScreenProps {
  pin: string;
  playerName: string;
  avatarSlug: string;
  error: string | null;
  submitting: boolean;
  onBackClick: () => void;
  onPinChange: (pin: string) => void;
  onPlayerNameChange: (name: string) => void;
  onAvatarSelect: (slug: string) => void;
  onSubmit: (event: Event) => void;
}

/**
 * JoinScreen component - Renders the student join screen with avatar selection
 * Pure extraction from main.ts renderJoinScreen method
 */
export class JoinScreen {
  private container: HTMLElement;
  private props: JoinScreenProps;

  constructor(container: HTMLElement, props: JoinScreenProps) {
    this.container = container;
    this.props = props;
  }

  /**
   * Render the join screen
   */
  render(): void {
    const avatarsHtml = AVATARS.map(
      (a) => `
        <div class="student-avatar-card ${this.props.avatarSlug === a.slug ? 'selected' : ''}" data-slug="${a.slug}">
          ${this.props.avatarSlug === a.slug ? `<div class="student-avatar-check">${Icons.check(14)}</div>` : ''}
          <img src="${a.image}" alt="${a.label}" class="student-avatar-img" />
          <span class="student-avatar-label">${a.label}</span>
        </div>
      `
    ).join('');

    this.container.innerHTML = `
      <div class="join-scene-container animate-fade-in">
        <div class="join-voxel-card">
          <div class="join-card-header">
            <button id="joinBackBtn" class="vocab-hud-btn">◀ TITLE</button>
            <span class="join-school-badge">PROSPERIDAD DISTRICT</span>
          </div>

          <h2 class="join-title">JOIN GAME ROOM</h2>
          <p class="join-subtitle">Enter your teacher's 6-digit Room PIN and choose your student avatar</p>

          ${this.props.error ? `
            <div class="join-error-box animate-shake">
              <span>${this.props.error}</span>
            </div>
          ` : ''}

          <form id="joinForm" class="join-form">
            <div class="join-field-group">
              <label class="join-label">6-DIGIT ROOM PIN</label>
              <input
                id="pinInput"
                type="text"
                maxlength="6"
                placeholder="123456"
                value="${this.props.pin}"
                class="join-input join-input-pin"
                required
                autocomplete="off"
              />
            </div>

            <div class="join-field-group">
              <label class="join-label">YOUR PLAYER NAME</label>
              <input
                id="nameInput"
                type="text"
                maxlength="25"
                placeholder="Enter character name..."
                value="${this.props.playerName}"
                class="join-input"
                required
                autocomplete="off"
              />
            </div>

            <div class="join-field-group">
              <label class="join-label">CHOOSE YOUR STUDENT CHARACTER</label>
              <div class="student-avatar-grid">
                ${avatarsHtml}
              </div>
            </div>

            <div id="submitJoinBtnFrame" class="vocab-btn-frame" style="margin-top: 6px;">
              <button
                type="submit"
                id="submitJoinBtn"
                class="vocab-btn vocab-btn-green"
                style="height: 50px; font-size: 18px; letter-spacing: 1.5px;"
                ${this.props.submitting ? 'disabled' : ''}
              >
                <span>${Icons.arrowRight(20)}</span>
                <span>${this.props.submitting ? 'JOINING ROOM...' : 'START ADVENTURE'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    document.getElementById('joinBackBtn')?.addEventListener('click', () => {
      soundManager.playClick();
      this.props.onBackClick();
    });

    const pinIn = document.getElementById('pinInput') as HTMLInputElement;
    const nameIn = document.getElementById('nameInput') as HTMLInputElement;
    const btnFrame = document.getElementById('submitJoinBtnFrame');

    pinIn?.focus();

    pinIn?.addEventListener('input', (e) => {
      this.props.onPinChange((e.target as HTMLInputElement).value);
    });

    nameIn?.addEventListener('input', (e) => {
      this.props.onPlayerNameChange((e.target as HTMLInputElement).value);
    });

    btnFrame?.addEventListener('mouseenter', () => soundManager.playHover());

    document.querySelectorAll('.student-avatar-card').forEach((card) => {
      card.addEventListener('mouseenter', () => soundManager.playHover());
      card.addEventListener('click', () => {
        const slug = card.getAttribute('data-slug');
        if (slug && this.props.avatarSlug !== slug) {
          soundManager.playClick();
          this.props.onAvatarSelect(slug);

          document.querySelectorAll('.student-avatar-card').forEach((c) => {
            const isMatch = c.getAttribute('data-slug') === slug;
            c.classList.toggle('selected', isMatch);
            const existingCheck = c.querySelector('.student-avatar-check');
            if (isMatch && !existingCheck) {
              const checkDiv = document.createElement('div');
              checkDiv.className = 'student-avatar-check';
              checkDiv.innerHTML = Icons.check(14);
              c.prepend(checkDiv);
            } else if (!isMatch && existingCheck) {
              existingCheck.remove();
            }
          });

          soundManager.speakCharacterVoice(slug);
        }
      });
    });

    document.getElementById('joinForm')?.addEventListener('submit', (e) => this.props.onSubmit(e));
  }

  /**
   * Update props and re-render
   */
  updateProps(newProps: Partial<JoinScreenProps>): void {
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
