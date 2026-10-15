export type QualityTier = 'high' | 'medium' | 'low';

export interface DeviceInfo {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  userAgent?: string;
}

const MOBILE_RE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

/** Same thresholds as detectDeviceCapabilities in src/game2d.ts (copied, not imported). */
export function detectQuality(info: DeviceInfo): QualityTier {
  const hc = info.hardwareConcurrency || 4;
  const mem = info.deviceMemory || 8;
  const isMobile = MOBILE_RE.test(info.userAgent ?? '');
  if (isMobile) {
    if (hc <= 2 || mem <= 2) return 'low';
    if (hc <= 4 && mem <= 4) return 'medium';
    return 'high';
  }
  // Desktop defaults to high quality for crisp, clear visual interface
  if (hc <= 2 && mem <= 2) return 'low';
  return 'high';
}

/** Reads the current browser (or returns 'medium' outside one). deviceMemory <= 4 caps at medium. */
export function detectQualityFromNavigator(): QualityTier {
  if (typeof navigator === 'undefined') return 'medium';
  const nav = navigator as Navigator & { deviceMemory?: number };
  return detectQuality({
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    userAgent: nav.userAgent,
  });
}
