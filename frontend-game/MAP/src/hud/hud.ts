import './hud.css';
import { RECENTER_ICON } from './icons';

/** DOM overlay: progress chip, recenter button, kingdom mini-indicator, tooltip (pointer-events only on controls). */
export class Hud {
  readonly el: HTMLDivElement;
  private readonly chip: HTMLDivElement;
  private readonly btn: HTMLButtonElement;
  private readonly dots: HTMLButtonElement[];
  private readonly tip: HTMLDivElement;
  private readonly onClick: () => void;
  private readonly onRecenter: () => void;
  private readonly dotHandlers: Array<() => void> = [];

  constructor(onRecenter: () => void, onKingdom: (k: number) => void = () => undefined) {
    this.onRecenter = onRecenter;
    this.el = document.createElement('div');
    this.el.className = 'vq-hud';
    this.chip = document.createElement('div');
    this.chip.className = 'vq-chip';
    this.chip.setAttribute('aria-hidden', 'true');
    this.btn = document.createElement('button');
    this.btn.type = 'button';
    this.btn.className = 'vq-recenter';
    this.btn.setAttribute('aria-label', 'Recenter on current level');
    this.btn.innerHTML = RECENTER_ICON;
    this.onClick = () => this.onRecenter();
    this.btn.addEventListener('click', this.onClick);
    const kd = document.createElement('div');
    kd.className = 'vq-kdots';
    this.dots = [1, 2, 3].map((k) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'vq-kdot';
      d.setAttribute('aria-label', `Go to Kingdom ${k}`);
      d.textContent = '';
      const h = (): void => onKingdom(k);
      this.dotHandlers.push(h);
      d.addEventListener('click', h);
      return d;
    });
    for (const d of this.dots) kd.appendChild(d);
    this.tip = document.createElement('div');
    this.tip.className = 'vq-tooltip';
    this.tip.hidden = true;
    this.tip.setAttribute('aria-hidden', 'true');
    this.el.append(this.chip, this.btn, kd, this.tip);
  }

  setProgress(kingdom: number, level: number, global: number): void {
    this.chip.innerHTML = `Level ${global} / 135<small>Kingdom ${kingdom}: ${level}/45</small>`;
    this.dots.forEach((d, i) => {
      d.classList.toggle('is-current', i + 1 === kingdom);
      if (i + 1 === kingdom) d.setAttribute('aria-current', 'true');
      else d.removeAttribute('aria-current');
    });
  }

  /** Dots of kingdoms above `activeMapId` are disabled (not unlocked yet). */
  setUnlocked(activeMapId: number): void {
    this.dots.forEach((d, i) => {
      const locked = i + 1 > activeMapId;
      d.disabled = locked;
      d.classList.toggle('is-locked', locked);
    });
  }

  setEmphasis(on: boolean): void {
    this.btn.classList.toggle('is-emphasis', on);
  }

  get emphasized(): boolean {
    return this.btn.classList.contains('is-emphasis');
  }

  showTooltip(text: string, x: number, y: number, width: number): void {
    if (this.tip.textContent !== text) this.tip.textContent = text;
    this.tip.hidden = false;
    const left = Math.min(Math.max(8, x + 14), Math.max(8, width - 220));
    this.tip.style.transform = `translate(${left}px, ${Math.max(8, y - 44)}px)`;
  }

  hideTooltip(): void {
    this.tip.hidden = true;
  }

  get tooltipText(): string {
    return this.tip.hidden ? '' : (this.tip.textContent ?? '');
  }

  destroy(): void {
    this.btn.removeEventListener('click', this.onClick);
    this.dots.forEach((d, i) => d.removeEventListener('click', this.dotHandlers[i]));
    this.el.remove();
  }
}
