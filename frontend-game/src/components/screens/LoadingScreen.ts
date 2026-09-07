interface LoadingScreenProps {
  loadingProgress: number;
  loadingTargetScreen: 'join' | 'world_map' | 'question';
}

/**
 * LoadingScreen component - Renders the loading screen with progress bar
 * Pure extraction from main.ts renderLoadingScreen method
 */
export class LoadingScreen {
  private container: HTMLElement;
  private props: LoadingScreenProps;

  constructor(container: HTMLElement, props: LoadingScreenProps) {
    this.container = container;
    this.props = props;
  }

  /**
   * Render the loading screen
   */
  render(): void {
    const totalSegments = 15;
    const progress = Math.min(this.props.loadingProgress, totalSegments);

    const segmentsHtml = Array.from({ length: totalSegments })
      .map((_, i) => `<div class="loading-segment ${i < progress ? 'active' : ''}"></div>`)
      .join('');

    const isJoining = this.props.loadingTargetScreen === 'join';
    const isQuestion = this.props.loadingTargetScreen === 'question';
    const title = isJoining
      ? 'PREPARING VOCABULARY QUEST...'
      : isQuestion
      ? 'ENTERING WORD CHALLENGE...'
      : 'ENTERING VOCABULARY KINGDOMS...';

    const subtitle = isJoining
      ? 'LOADING STUDENT REGISTRATION & AVATARS'
      : isQuestion
      ? 'LOADING VOCABULARY QUESTIONS & MEDIA'
      : 'LOADING KINGDOM STAGES & WORD CHALLENGES';

    this.container.innerHTML = `
      <div class="loading-scene-container animate-fade-in">
        <div class="loading-box">
          <!-- Pixel Corner Accents -->
          <div class="loading-corner-pixels top-left">
            <span class="pixel-sq sq-1"></span>
            <span class="pixel-sq sq-2"></span>
          </div>
          <div class="loading-corner-pixels top-right">
            <span class="pixel-sq sq-1"></span>
          </div>
          <div class="loading-corner-pixels bottom-left">
            <span class="pixel-sq sq-1"></span>
          </div>
          <div class="loading-corner-pixels bottom-right">
            <span class="pixel-sq sq-1"></span>
            <span class="pixel-sq sq-2"></span>
            <span class="pixel-sq sq-3"></span>
          </div>

          <!-- Stepped Pixel Banner Badge -->
          <div class="loading-banner-wrap">
            <div class="loading-banner">
              <span class="banner-pixel banner-pixel-left"></span>
              <div class="loading-text-title">${title}</div>
              <span class="banner-pixel banner-pixel-right"></span>
            </div>
          </div>

          <!-- Segmented Progress Bar -->
          <div class="loading-segmented-bar">
            ${segmentsHtml}
          </div>

          <!-- Subtitle with flanking pixel diamond decorators -->
          <div class="loading-subtitle-wrap">
            <span class="loading-subtitle-decor decor-left">
              <span class="decor-cube"></span>
              <span class="decor-cube"></span>
            </span>
            <div class="loading-text-subtitle">${subtitle}</div>
            <span class="loading-subtitle-decor decor-right">
              <span class="decor-cube"></span>
              <span class="decor-cube"></span>
            </span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Update props and re-render
   */
  updateProps(newProps: Partial<LoadingScreenProps>): void {
    this.props = { ...this.props, ...newProps };
    // Only re-render if target screen changes, not on progress updates
    // This allows updateProgress() to handle smooth animation
    if (newProps.loadingTargetScreen !== undefined) {
      this.render();
    }
  }

  /**
   * Update progress segments directly without full re-render
   * This is called by main.ts for smooth animation
   */
  updateProgress(progress: number): void {
    this.props.loadingProgress = progress;
    const segments = this.container.querySelectorAll('.loading-segment');
    if (segments.length > 0) {
      for (let i = 0; i < segments.length; i++) {
        if (i < progress) {
          segments[i].classList.add('active');
        } else {
          segments[i].classList.remove('active');
        }
      }
    }
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    // Event listeners are automatically cleaned up when innerHTML is replaced
  }
}
