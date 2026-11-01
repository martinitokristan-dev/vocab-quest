import { WORLD_H, WORLD_W } from '../../data/world';
import { clamp, easeInOutCubic } from './math';

export interface Camera {
  cx: number; // world point at the viewport centre
  cy: number;
  zoom: number;
}

export const MIN_READABLE = 0.46;
export const MAX_ZOOM = 3.2;
export const FOLLOW_RATE = 8;
/** Camera sits 12% of viewport height above the avatar (Tala: similar offset keeps character visible but not blocking buildings) */
export const FOLLOW_OFFSET = 0.12;

export function fitZoom(vw: number): number {
  return vw / WORLD_W;
}

export function minZoom(vw: number): number {
  return Math.max(fitZoom(vw), MIN_READABLE);
}

export function defaultZoom(vw: number, vh: number): number {
  return vw >= vh ? Math.max(minZoom(vw), vw / WORLD_W) : Math.max(minZoom(vw), 0.55);
}

/** Clamps zoom and centre so the viewport never leaves the world. The single choke point for all camera updates. */
export function clampToWorld(cam: Camera, vw: number, vh: number): Camera {
  const zoom = clamp(cam.zoom, minZoom(vw), MAX_ZOOM);
  const halfW = vw / (2 * zoom);
  const halfH = vh / (2 * zoom);
  const cx = halfW * 2 >= WORLD_W ? WORLD_W / 2 : clamp(cam.cx, halfW, WORLD_W - halfW);
  const cy = halfH * 2 >= WORLD_H ? WORLD_H / 2 : clamp(cam.cy, halfH, WORLD_H - halfH);
  return { cx, cy, zoom };
}

/** Zoom by `factor` keeping the world point under screen position (sx, sy) fixed. Does not clamp the centre. */
export function zoomAround(cam: Camera, factor: number, sx: number, sy: number, vw: number, vh: number): Camera {
  const zoom = clamp(cam.zoom * factor, minZoom(vw), MAX_ZOOM);
  const wx = cam.cx + (sx - vw / 2) / cam.zoom;
  const wy = cam.cy + (sy - vh / 2) / cam.zoom;
  return { zoom, cx: wx - (sx - vw / 2) / zoom, cy: wy - (sy - vh / 2) / zoom };
}

/** Frame-rate independent exponential smoothing: returns the new value. */
export function smoothDamp(current: number, target: number, dt: number, rate = FOLLOW_RATE): number {
  return current + (target - current) * (1 - Math.exp(-dt * rate));
}

/** Follow target centre: the camera centre sits 12% of the viewport height above the avatar. */
export function followTarget(avatarX: number, avatarY: number, vh: number, zoom: number): { cx: number; cy: number } {
  return { cx: avatarX, cy: avatarY - (FOLLOW_OFFSET * vh) / zoom };
}

/** Ordinary glide duration in ms: clamp(distanceInViewportHeights * 450 + 500, 600, 1200). */
export function glideDuration(distanceInViewportHeights: number): number {
  return clamp(distanceInViewportHeights * 450 + 500, 600, 1200);
}

export const KINGDOM_TRAVEL_MS = 2800;
/** Glides longer than this many viewport heights use a warp fade instead. */
export const WARP_THRESHOLD_VH = 2.5;

export function shouldWarp(distanceInViewportHeights: number): boolean {
  return distanceInViewportHeights > WARP_THRESHOLD_VH;
}

/** Camera position/zoom at progress t of an ease-in-out cubic glide. */
export function glideAt(from: Camera, to: Camera, t: number): Camera {
  const e = easeInOutCubic(clamp(t, 0, 1));
  return {
    cx: from.cx + (to.cx - from.cx) * e,
    cy: from.cy + (to.cy - from.cy) * e,
    zoom: from.zoom + (to.zoom - from.zoom) * e,
  };
}
