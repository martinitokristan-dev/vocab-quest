import type { Ctx2D } from '../raster/canvas';
import { FONT_FAMILY } from '../raster/text';

/**
 * Canvas decals painted onto landmark sprites (real text, no copied bitmaps). The context is already
 * transformed so drawing uses reference-pixel coordinates of K1 S1.
 */
export type Decal = (ctx: Ctx2D) => void;

function text(
  ctx: Ctx2D,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  opts: { slope?: number; weight?: number; stroke?: string; strokeW?: number; align?: CanvasTextAlign } = {},
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.transform(1, opts.slope ?? 0, 0, 1, 0, 0);
  ctx.font = `${opts.weight ?? 700} ${size}px ${FONT_FAMILY}`;
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = 'middle';
  if (opts.stroke) {
    ctx.lineWidth = opts.strokeW ?? 3;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = opts.stroke;
    ctx.strokeText(s, 0, 0);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, 0, 0);
  ctx.restore();
}

function crest(ctx: Ctx2D, x: number, y: number, r: number): void {
  ctx.fillStyle = '#c9971c';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f4aa0';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.68, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f3d25a';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a5a10';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

export const DECALS: Readonly<Record<string, Decal>> = {
  school(ctx) {
    // DepEd mark: flame over the D, "Dep" blue, "ED" red
    ctx.fillStyle = '#d7262f';
    ctx.beginPath();
    ctx.moveTo(293, 372);
    ctx.quadraticCurveTo(300, 382, 296, 390);
    ctx.quadraticCurveTo(290, 388, 293, 372);
    ctx.fill();
    text(ctx, 'Dep', 272, 404, 25, '#1b3f93', { weight: 800, align: 'center', stroke: 'rgba(255,255,255,0.7)', strokeW: 2 });
    text(ctx, 'ED', 317, 404, 25, '#d7262f', { weight: 800, align: 'center', stroke: 'rgba(255,255,255,0.7)', strokeW: 2 });
    text(ctx, 'EAST PROSPERIDAD CENTRAL', 295, 436, 13, '#5a3a1e', { slope: -0.16 });
    text(ctx, 'ELEMENTARY SCHOOL', 295, 453, 13, '#5a3a1e', { slope: -0.16 });
    text(ctx, 'SCHOOL ID: 10-135STS', 297, 470, 9, '#5a3a1e', { slope: -0.16 });
  },
  hall(ctx) {
    ctx.fillStyle = '#26303f';
    ctx.beginPath();
    ctx.roundRect(800, 322, 222, 40, 10);
    ctx.fill();
    ctx.strokeStyle = '#8a6a2a';
    ctx.lineWidth = 2;
    ctx.stroke();
    crest(ctx, 822, 343, 16);
    text(ctx, 'BAYAN NG PROSPERIDAD', 929, 345, 17, '#ffffff', { stroke: '#10151f', strokeW: 3 });
  },
  capitol(ctx) {
    // pediment: cream triangle with a gold border above the plaque, crest in the tympanum
    ctx.fillStyle = '#e6d29a';
    ctx.beginPath();
    ctx.moveTo(1521, 168);
    ctx.lineTo(1582, 217);
    ctx.lineTo(1460, 217);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#c9a23c';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,90,40,0.5)';
    ctx.lineWidth = 1;
    for (let y = 176; y < 214; y += 6) {
      ctx.beginPath();
      ctx.moveTo(1521 - (y - 168) * 1.2, y);
      ctx.lineTo(1521 + (y - 168) * 1.2, y);
      ctx.stroke();
    }
    crest(ctx, 1520, 200, 15);
    ctx.fillStyle = '#efe3bf';
    ctx.fillRect(1462, 217, 123, 33);
    ctx.strokeStyle = '#8a7440';
    ctx.lineWidth = 2;
    ctx.strokeRect(1462, 217, 123, 33);
    text(ctx, 'PROVINCIAL CAPITOL', 1523, 233, 12, '#3b2c18', { slope: 0.02 });
  },
  sign_planter(ctx) {
    // WELCOME plaque: a cream tiled parallelogram rising to the right, with green skewed lettering
    ctx.fillStyle = '#d9c9a0';
    ctx.beginPath();
    ctx.moveTo(112, 690);
    ctx.lineTo(372, 628);
    ctx.lineTo(388, 656);
    ctx.lineTo(128, 722);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,100,60,0.5)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const t = i / 8;
      ctx.beginPath();
      ctx.moveTo(112 + 260 * t, 690 - 62 * t);
      ctx.lineTo(128 + 260 * t, 722 - 66 * t);
      ctx.stroke();
    }
    ctx.save();
    // shifted right and slightly smaller so the fence in front no longer hides the "W"
    ctx.translate(270, 668);
    ctx.rotate(-0.235);
    ctx.font = `800 35px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f3d14';
    ctx.strokeText('WELCOME', 0, 0);
    ctx.fillStyle = '#2f9a38';
    ctx.fillText('WELCOME', 0, 0);
    ctx.restore();
  },
};
