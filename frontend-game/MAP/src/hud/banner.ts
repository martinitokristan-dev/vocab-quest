export const BANNER_VISIBLE_MS = 2500;
export const BANNER_FADE_MS = 350;

/** Kingdom title banner (DOM, frosted dark strip across the upper third). */
export class Banner {
  readonly el: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly sub: HTMLParagraphElement;
  private readonly bar: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'vq-banner';
    this.el.setAttribute('role', 'status');
    this.el.hidden = true;
    this.title = document.createElement('h2');
    this.title.className = 'vq-banner-title';
    this.sub = document.createElement('p');
    this.sub.className = 'vq-banner-sub';
    this.bar = document.createElement('div');
    this.bar.className = 'vq-banner-bar';
    this.el.append(this.title, this.sub, this.bar);
  }

  get visible(): boolean {
    return this.el.classList.contains('is-visible');
  }

  /**
   * Shows the banner: `is-visible` is set for BANNER_VISIBLE_MS (fade in during its first 350 ms), then it fades out
   * for 350 ms. Resolves once hidden. `wait` is the owner's cancellable timer.
   */
  async show(name: string, subtitle: string, color: string, reduced: boolean, wait: (ms: number) => Promise<void>): Promise<void> {
    this.title.textContent = name;
    this.sub.textContent = subtitle;
    this.bar.style.background = color;
    this.el.classList.toggle('is-reduced', reduced);
    this.el.hidden = false;
    // force a style flush so the transition runs from the hidden state
    void this.el.offsetWidth;
    this.el.classList.add('is-visible');
    try {
      await wait(BANNER_VISIBLE_MS);
    } finally {
      this.el.classList.remove('is-visible');
    }
    await wait(BANNER_FADE_MS);
    this.el.hidden = true;
  }

  hideNow(): void {
    this.el.classList.remove('is-visible');
    this.el.hidden = true;
  }

  destroy(): void {
    this.el.remove();
  }
}
