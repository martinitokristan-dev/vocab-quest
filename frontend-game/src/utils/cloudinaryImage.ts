/**
 * Smaller question pictures without re-uploading anything.
 *
 * Teachers upload pictures at full size (phone photos are 3-5 MB). Cloudinary can send a
 * resized, compressed copy instead: `f_auto` picks WebP/AVIF when the browser supports it,
 * `q_auto` picks a quality that looks the same, `c_limit,w_1200` only shrinks (never enlarges).
 * Cloudinary makes each smaller copy once and then serves it from its CDN cache.
 *
 * Only Cloudinary *image* links are changed. Anything else (local /storage links, bundled
 * assets, audio, video) is returned unchanged. A link that already has transformations is
 * also left as is.
 */
const IMAGE_UPLOAD_MARKER = '/image/upload/';
const DELIVERY_TRANSFORM = 'f_auto,q_auto,c_limit,w_1200';

export function optimizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return url ?? null;
  if (!url.includes('res.cloudinary.com') || !url.includes(IMAGE_UPLOAD_MARKER)) return url;

  const [head, tail] = url.split(IMAGE_UPLOAD_MARKER, 2);
  const firstSegment = tail.split('/', 1)[0];
  // Already transformed (e.g. "f_auto,q_auto" or "w_800") - keep it.
  if (/(^|,)(f|q|w|h|c|e|t)_/.test(firstSegment)) return url;

  return `${head}${IMAGE_UPLOAD_MARKER}${DELIVERY_TRANSFORM}/${tail}`;
}
