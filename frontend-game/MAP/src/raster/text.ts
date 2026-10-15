/** Canvas text helpers: MinecraftTen first, Quicksand fallback; callers re-raster once fonts are ready. */
export const FONT_FAMILY = 'MinecraftTen, Quicksand, sans-serif';

export function fontString(size: number, weight = 700): string {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

/** Calls cb once when document fonts are ready (immediately if the API is unavailable). */
export function onFontsReady(cb: () => void): void {
  if (typeof document === 'undefined' || !document.fonts?.ready) {
    cb();
    return;
  }
  void document.fonts.ready.then(cb);
}

export interface LabelStyle {
  size: number;
  color: string;
  stroke?: string;
  strokeWidth?: number;
  weight?: number;
  align?: CanvasTextAlign;
}

export function drawLabel(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: LabelStyle,
): void {
  ctx.font = fontString(style.size, style.weight ?? 700);
  ctx.textAlign = style.align ?? 'center';
  ctx.textBaseline = 'middle';
  if (style.stroke) {
    ctx.lineWidth = style.strokeWidth ?? 2;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = style.stroke;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = style.color;
  ctx.fillText(text, x, y);
}
