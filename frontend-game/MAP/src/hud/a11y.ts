import { KINGDOMS, LEVELS_PER_KINGDOM } from '../../data/world';
import type { NodeState } from '../api/types';

export const MAX_PROXIES = 24;
const ANNOUNCE_GAP_MS = 1000;
const PROXY_SIZE = 48;

export interface A11yHost {
  /** A proxy received focus: scroll the camera to the node. */
  focusNode(n: NodeState): void;
  /** Enter or click on a proxy. */
  activate(n: NodeState): void;
  /** Focus left or entered a proxy (drives the focus ring drawn on the canvas). */
  focusChanged(n: NodeState | null): void;
}

export function labelFor(n: NodeState): string {
  const kingdom = KINGDOMS[n.kingdom - 1].name;
  let status: string;
  if (!n.available) status = 'coming soon';
  else if (n.status === 'completed') status = `completed, ${n.stars} ${n.stars === 1 ? 'star' : 'stars'}`;
  else if (n.status === 'current') status = 'current level';
  else status = 'locked';
  return `Level ${n.level} of ${LEVELS_PER_KINGDOM}, ${kingdom}, ${status}`;
}

/** Screen-reader and keyboard proxies for the canvas nodes plus the live region (DESIGN 11). */
export class A11y {
  readonly el: HTMLDivElement;
  private readonly live: HTMLDivElement;
  private readonly buttons: HTMLButtonElement[] = [];
  private readonly bound: Array<NodeState | null> = [];
  private readonly host: A11yHost;
  private lastAnnounce = -Infinity;
  private pendingText = '';
  private pendingTimer = 0;
  private focused: NodeState | null = null;

  constructor(host: A11yHost) {
    this.host = host;
    this.el = document.createElement('div');
    this.el.className = 'vq-a11y';
    this.live = document.createElement('div');
    this.live.className = 'vq-live';
    this.live.setAttribute('role', 'status');
    this.live.setAttribute('aria-live', 'polite');
    this.el.appendChild(this.live);
    for (let i = 0; i < MAX_PROXIES; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'vq-node-proxy';
      b.hidden = true;
      b.addEventListener('focus', () => {
        const n = this.bound[i];
        if (!n) return;
        this.focused = n;
        this.host.focusChanged(n);
        this.host.focusNode(n);
      });
      b.addEventListener('blur', () => {
        if (this.focused === this.bound[i]) this.focused = null;
        this.host.focusChanged(null);
      });
      b.addEventListener('click', () => {
        const n = this.bound[i];
        if (n) this.host.activate(n);
      });
      this.buttons.push(b);
      this.bound.push(null);
      this.el.appendChild(b);
    }
  }

  /** True while a proxy owns keyboard focus (bindings are then kept stable). */
  get holdsFocus(): boolean {
    return this.buttons.some((b) => b === document.activeElement);
  }

  get visibleCount(): number {
    return this.buttons.filter((b) => !b.hidden).length;
  }

  /**
   * Re-binds the proxies to `nodes` (the visible nodes) in bottom-to-top order and positions them. While a proxy has
   * focus only the positions are refreshed.
   */
  update(nodes: readonly NodeState[], toScreen: (x: number, y: number) => { x: number; y: number }): void {
    if (!this.holdsFocus) {
      const sorted = nodes.slice(0, MAX_PROXIES).sort((a, b) => b.y - a.y);
      for (let i = 0; i < MAX_PROXIES; i++) {
        const n = sorted[i] ?? null;
        const b = this.buttons[i];
        if (n !== this.bound[i]) {
          this.bound[i] = n;
          if (n) {
            b.setAttribute('aria-label', labelFor(n));
            b.dataset.kingdom = String(n.kingdom);
            b.dataset.level = String(n.level);
            if (n.status !== 'completed' && n.status !== 'current') b.setAttribute('aria-disabled', 'true');
            else b.removeAttribute('aria-disabled');
          }
        } else if (n) {
          b.setAttribute('aria-label', labelFor(n));
          if (n.status !== 'completed' && n.status !== 'current') b.setAttribute('aria-disabled', 'true');
          else b.removeAttribute('aria-disabled');
        }
        b.hidden = !n;
      }
    }
    for (let i = 0; i < MAX_PROXIES; i++) {
      const n = this.bound[i];
      if (!n) continue;
      const p = toScreen(n.x, n.y);
      this.buttons[i].style.transform = `translate(${(p.x - PROXY_SIZE / 2).toFixed(1)}px, ${(p.y - PROXY_SIZE / 2).toFixed(1)}px)`;
    }
  }

  /** Live-region message, at most one per second (the latest wins). */
  announce(text: string, now: number): void {
    if (now - this.lastAnnounce >= ANNOUNCE_GAP_MS) {
      this.lastAnnounce = now;
      this.live.textContent = text;
      return;
    }
    this.pendingText = text;
    if (!this.pendingTimer) {
      this.pendingTimer = window.setTimeout(() => {
        this.pendingTimer = 0;
        this.lastAnnounce = performance.now();
        this.live.textContent = this.pendingText;
      }, ANNOUNCE_GAP_MS - (now - this.lastAnnounce));
    }
  }

  destroy(): void {
    if (this.pendingTimer) window.clearTimeout(this.pendingTimer);
    this.pendingTimer = 0;
    this.el.remove();
  }
}
