export interface KeyboardHandlers {
  pan(dxWorld: number, dyWorld: number): void;
  panViewport(pages: number): void;
  zoom(factor: number): void;
  recenter(): void;
  gestureStart(): void;
  isLocked(): boolean;
}

/** Canvas keyboard controls: arrows pan 120 (shift 360), PageUp/Down, +/-, Home. */
export class KeyboardInput {
  private readonly el: HTMLElement;
  private readonly h: KeyboardHandlers;
  private readonly onKey: (e: KeyboardEvent) => void;
  private destroyed = false;

  constructor(el: HTMLElement, h: KeyboardHandlers) {
    this.el = el;
    this.h = h;
    this.onKey = (e) => this.key(e);
    el.addEventListener('keydown', this.onKey);
  }

  private key(e: KeyboardEvent): void {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const step = e.shiftKey ? 360 : 120;
    const h = this.h;
    let handled = true;
    if (h.isLocked()) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', '+', '=', '-'].includes(e.key)) {
        e.preventDefault();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowUp': h.gestureStart(); h.pan(0, -step); break;
      case 'ArrowDown': h.gestureStart(); h.pan(0, step); break;
      case 'ArrowLeft': h.gestureStart(); h.pan(-step, 0); break;
      case 'ArrowRight': h.gestureStart(); h.pan(step, 0); break;
      case 'PageUp': h.gestureStart(); h.panViewport(-1); break;
      case 'PageDown': h.gestureStart(); h.panViewport(1); break;
      case '+':
      case '=': h.gestureStart(); h.zoom(1.2); break;
      case '-': h.gestureStart(); h.zoom(1 / 1.2); break;
      case 'Home': h.recenter(); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.el.removeEventListener('keydown', this.onKey);
  }
}
