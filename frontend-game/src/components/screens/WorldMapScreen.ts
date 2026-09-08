import { Icons } from '../../icons';
import { soundManager } from '../../soundManager';
import { Game2DMapRenderer, type StarHistoryItem } from '../../game2d';

interface WorldMapScreenProps {
  playerName: string;
  avatarSlug: string;
  avatarImage: string;
  activeMapId: number;
  currentQuestionIndex: number;
  totalStars: number;
  history: StarHistoryItem[];
  mapFlowOptions: any;
  mapRenderer: Game2DMapRenderer | null;
  onAvatarClick: () => void;
  onPauseClick: () => void;
  onMapRendererInit: (renderer: Game2DMapRenderer) => void;
  onMapRendererUpdate: (renderer: Game2DMapRenderer) => void;
}

/**
 * WorldMapScreen component - Renders the 2D world map with player HUD
 * Pure extraction from main.ts renderWorldMapScreen method
 */
export class WorldMapScreen {
  private container: HTMLElement;
  private props: WorldMapScreenProps;

  constructor(container: HTMLElement, props: WorldMapScreenProps) {
    this.container = container;
    this.props = props;
  }

  /**
   * Render the world map screen
   */
  render(): void {
    this.container.innerHTML = `
      <!-- Top-Left Player Profile & Star HUD -->
      <div class="candy-hud-top-left animate-fade-in">
        <div class="candy-player-card candy-hud-interactive" id="playerAvatarBox" title="${this.props.playerName || 'Hero Student'}">
          <div class="candy-avatar-circle">
            <img src="${this.props.avatarImage || '/assets/mascot_girl.png'}" class="candy-avatar-img" />
          </div>
          <div class="candy-player-info">
            <div class="candy-player-name">${this.props.playerName || 'Hero Student'}</div>
            <div class="candy-star-row">
              <div class="candy-star-icon-wrap">
                <svg class="candy-star-svg" viewBox="0 0 36 36">
                  <defs>
                    <linearGradient id="hudStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#FFF566" />
                      <stop offset="35%" stop-color="#FFD000" />
                      <stop offset="75%" stop-color="#FF9900" />
                      <stop offset="100%" stop-color="#E67300" />
                    </linearGradient>
                  </defs>
                  <path d="M 18,2 L 22.5,12.5 L 34,14 L 25.5,22 L 28,33.5 L 18,27.5 L 8,33.5 L 10.5,22 L 2,14 L 13.5,12.5 Z"
                    fill="url(#hudStarGrad)" stroke="#FFFFFF" stroke-width="2.2" stroke-linejoin="round" />
                  <ellipse cx="18" cy="11" rx="4.5" ry="2.2" fill="rgba(255,255,255,0.75)" />
                </svg>
              </div>
              <span class="candy-star-count-num">${this.props.totalStars}</span>
              <span class="candy-star-count-label">STARS</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Top-Right Controls HUD -->
      <div class="candy-hud-top-right animate-fade-in">
        <div class="candy-zone-pill">
          <span>${Icons.map(18)}</span>
          <span>PROSPERIDAD MAP</span>
        </div>
        <button id="mapPauseBtn" class="candy-menu-btn candy-hud-interactive">
          <span>${Icons.menu(18)}</span>
          <span>MENU</span>
        </button>
      </div>

      <!-- Fullscreen 2D Canvas Container -->
      <div id="canvasContainer" style="width: 100%; height: 100vh; height: 100dvh; position: fixed; inset: 0;"></div>
    `;

    requestAnimationFrame(() => {
      this.attachEventListeners();
      this.initMapRenderer();
    });
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    document.getElementById('playerAvatarBox')?.addEventListener('click', () => {
      soundManager.playClick();
      this.props.onAvatarClick();
    });

    document.getElementById('mapPauseBtn')?.addEventListener('click', () => {
      soundManager.playClick();
      soundManager.stopSpeech();
      this.props.onPauseClick();
    });
  }

  /**
   * Initialize or update the map renderer
   */
  private initMapRenderer(): void {
    const container = document.getElementById('canvasContainer');
    if (!container) return;

    if (this.props.mapRenderer) {
      this.props.mapRenderer.updateProgress(
        this.props.activeMapId,
        this.props.currentQuestionIndex,
        this.props.history || [] // Pass history for star display
      );
      this.props.mapRenderer.setMapFlowOptions(this.props.mapFlowOptions);
      // Only remount if container is empty (canvas was removed)
      if (container.children.length === 0) {
        this.props.mapRenderer.remount(container);
      }
      // Call update callback to trigger pending actions
      requestAnimationFrame(() => {
        if (this.props.mapRenderer) {
          this.props.onMapRendererUpdate(this.props.mapRenderer);
        }
      });
    } else {
      const renderer = new Game2DMapRenderer(
        container,
        this.props.avatarImage || '/assets/mascot_girl.png',
        this.props.activeMapId,
        this.props.currentQuestionIndex,
        undefined,
        undefined,
        this.props.history || [], // Pass history for star display
        this.props.mapFlowOptions
      );
      // Call init callback after renderer is created
      requestAnimationFrame(() => {
        this.props.onMapRendererInit(renderer);
      });
    }
  }

  /**
   * Update props and re-render
   */
  updateProps(newProps: Partial<WorldMapScreenProps>): void {
    this.props = { ...this.props, ...newProps };
    // Re-render to update HUD elements, but preserve map renderer
    this.render();
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    // Event listeners are automatically cleaned up when innerHTML is replaced
  }
}
