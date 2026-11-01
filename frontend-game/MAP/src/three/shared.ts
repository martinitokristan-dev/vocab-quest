/**
 * Small helpers for the 3D map that do NOT import three.js, so screens can use them without
 * pulling the 3D code into the first download. The 3D world itself (World3D.ts) is loaded
 * with a dynamic import when the map opens (and warmed up by preloadMap3D on the join screen).
 */

/** Student model scale on the map (the GLB is about 1.05 units tall). */
export const AVATAR_SCALE = 1.1;
/** Height in units just above the student's head (for the YOU badge / speech bubble). */
export const AVATAR_HEAD_H = 1.05 * AVATAR_SCALE + 0.08;

const OLD_PICTURES: Record<string, string> = {
  mascot_girl: 'learner-girl',
  mascot_boy: 'learner-boy',
  scholar_girl: 'scholar-girl',
  scholar_boy: 'scholar-boy',
  sporty_girl: 'sporty-girl',
  explorer_boy: 'explorer-boy',
  morena_girl: 'sporty-girl',
  moreno_boy: 'explorer-boy',
};
const STUDENTS = new Set(['learner-girl', 'learner-boy', 'scholar-girl', 'scholar-boy', 'sporty-girl', 'explorer-boy']);

/**
 * Maps an avatar picture to its 3D model url, or null for unknown pictures.
 * Works for the new renders (/assets/students/learner-girl.webp) and the old PNGs (/assets/mascot_girl.png).
 */
export function avatarModelUrl(imageUrl: string): string | null {
  const m = /([a-z_-]+)\.(png|webp|jpg)/i.exec(imageUrl || '');
  if (!m) return null;
  const name = m[1].toLowerCase();
  const slug = STUDENTS.has(name) ? name : OLD_PICTURES[name];
  return slug ? `/models/students/${slug}.glb` : null;
}

/** True on phones and tablets (touch screen as the main input). */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return coarse || (navigator.maxTouchPoints ?? 0) > 1;
}

/** True on touch devices with few cores or little memory (fewer trees, smaller shadows, lower resolution). */
export function isLowEndDevice(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory ?? 8;
  const touch = 'ontouchstart' in window || (nav.maxTouchPoints ?? 0) > 0;
  return (touch && (cores <= 6 || mem <= 4)) || cores <= 2 || mem <= 2;
}

let webgl: boolean | null = null;
/** True when WebGL is available (checked once). */
export function hasWebGL(): boolean {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement('canvas');
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    webgl = false;
  }
  return webgl;
}

/** Starts downloading the 3D map code and the chosen student model in the background. */
export function preloadMap3D(avatarImage?: string): void {
  if (!hasWebGL()) return;
  void import('./World3D')
    .then((m) => {
      if (avatarImage) m.preloadStudentModel(avatarImage);
    })
    .catch(() => undefined);
}
