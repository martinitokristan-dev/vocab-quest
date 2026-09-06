interface LoadingScreenProps {
  loadingProgress: number;
  loadingTargetScreen: 'join' | 'world_map';
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
    const totalSegments = 16;
    const progress = Math.min(this.props.loadingProgress, totalSegments);

    const segmentsHtml = Array.from({ length: totalSegments })
      .map((_, i) => `<div class="loading-segment ${i < progress ? 'active' : ''}"></div>`)
      .join('');

    const isJoining = this.props.loadingTargetScreen === 'join';
    const title = isJoining ? 'PREPARING VOCABULARY QUEST...' : 'ENTERING VOCABULARY KINGDOMS...';
    const subtitle = isJoining
      ? 'Loading Student Registration & Avatars'
      : 'Loading Kingdom Stages & Word Challenges';

    this.container.innerHTML = `
      <div class="loading-scene-container animate-fade-in">
        <div class="loading-box">
          <div class="loading-text-title">${title}</div>
          <div class="loading-segmented-bar">
            ${segmentsHtml}
          </div>
          <div class="loading-text-subtitle">${subtitle}</div>
        </div>
      </div>
    `;
  }

  /**
   * Update props and re-render
   */
  updateProps(newProps: Partial<LoadingScreenProps>): void {
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
