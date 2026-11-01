/**
 * Shrinks a picture in the teacher's browser before it is uploaded.
 *
 * Why: phone photos are 3-5 MB. Uploading them through the free Render backend is slow
 * (45 s timeout), free Cloudinary refuses images over 10 MB, and every big original uses
 * the free storage quota. A 1600px copy looks the same in the game (the picture is shown
 * at most ~800px wide) and is usually 150-400 KB.
 *
 * Rules:
 * - Longest side at most 1600px (smaller pictures are never enlarged).
 * - Pictures with transparency stay transparent (saved as WebP; PNG if WebP is not supported).
 * - Other pictures are saved as JPEG at quality 0.82.
 * - Already small pictures (<= 400 KB and <= 1600px), GIF, SVG and non-images are sent unchanged.
 * - If anything fails, or the result is not smaller, the original file is sent. Uploading never breaks.
 */
const MAX_SIDE = 1600;
const SMALL_ENOUGH_BYTES = 400 * 1024;
const JPEG_QUALITY = 0.82;
const WEBP_QUALITY = 0.85;

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall back to <img> below */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const data = ctx.getImageData(0, 0, width, height).data;
  // Every 7th pixel is enough to find a transparent background or edge.
  for (let i = 3; i < data.length; i += 4 * 7) {
    if (data[i] < 250) return true;
  }
  return false;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function renamed(name: string, ext: string): string {
  const base = name.replace(/\.[^./\\]+$/, '') || 'image';
  return `${base}.${ext}`;
}

export async function compressImage(file: File): Promise<File> {
  try {
    if (!file || !file.type.startsWith('image/')) return file;
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;

    const decoded = await decode(file);
    try {
      const { width, height } = decoded;
      if (!width || !height) return file;

      const longest = Math.max(width, height);
      if (file.size <= SMALL_ENOUGH_BYTES && longest <= MAX_SIDE) return file;

      const scale = Math.min(1, MAX_SIDE / longest);
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return file;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(decoded.source, 0, 0, w, h);

      const mayHaveAlpha = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/avif';
      const transparent = mayHaveAlpha && hasTransparency(ctx, w, h);

      let blob: Blob | null;
      let ext: string;
      if (transparent) {
        blob = await toBlob(canvas, 'image/webp', WEBP_QUALITY);
        if (blob && blob.type === 'image/webp') {
          ext = 'webp';
        } else {
          blob = await toBlob(canvas, 'image/png');
          ext = 'png';
        }
      } else {
        blob = await toBlob(canvas, 'image/jpeg', JPEG_QUALITY);
        ext = 'jpg';
      }

      if (!blob || blob.size >= file.size) return file;
      return new File([blob], renamed(file.name, ext), { type: blob.type, lastModified: Date.now() });
    } finally {
      decoded.close();
    }
  } catch {
    return file;
  }
}
