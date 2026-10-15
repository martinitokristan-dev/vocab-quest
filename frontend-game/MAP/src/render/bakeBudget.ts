import { SEG_H, WORLD_W } from '../../data/world';
import { defaultZoom, minZoom } from '../core/camera';
import type { QualityTier } from '../core/quality';

export const BAKE_BUDGET = 120 * 1024 * 1024;
/** Ascending bake scales. */
export const SCALE_STEPS = [0.75, 1, 1.5, 2] as const;
export const TIER_CAP: Readonly<Record<QualityTier, number>> = { high: 2, medium: 2, low: 1.5 };

export function segBytes(scale: number): number {
  return Math.round(WORLD_W * SEG_H * 4 * scale * scale);
}

/** Segments that can be visible at once at the minimum zoom, plus one for partial overlap. */
export function visibleMax(vw: number, vh: number): number {
  return Math.ceil(vh / (minZoom(vw) * SEG_H)) + 1;
}

/** Visible + one ahead + one behind. */
export function maxBaked(vw: number, vh: number): number {
  return visibleMax(vw, vh) + 2;
}

/**
 * Largest scale step that is <= the tier cap, <= dpr * defaultZoom rounded up to the next step, and keeps
 * maxBaked * segBytes within BAKE_BUDGET. Falls back to 0.75.
 */
export function bakeScale(vw: number, vh: number, dpr: number, tier: QualityTier): number {
  const d = Math.min(dpr, tier === 'low' ? 1.5 : 2);
  const want = d * defaultZoom(vw, vh);
  const roundedUp = SCALE_STEPS.find((s) => s >= want - 1e-9) ?? 2;
  const limit = Math.min(TIER_CAP[tier], roundedUp);
  const mb = maxBaked(vw, vh);
  for (let i = SCALE_STEPS.length - 1; i >= 0; i--) {
    const s = SCALE_STEPS[i];
    if (s <= limit + 1e-9 && mb * segBytes(s) <= BAKE_BUDGET) return s;
  }
  return SCALE_STEPS[0];
}
