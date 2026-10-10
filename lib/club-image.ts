import sharp from "sharp";
import { validateProfileFile } from "@/lib/student-profile";
/** Decode untrusted raster data, bound dimensions, and strip metadata on re-encode. */
export async function prepareClubImage(bytes: Uint8Array, declaredMime: string) {
  const mime = validateProfileFile(bytes, declaredMime, 'headshot');
  try {
    const image = sharp(bytes, { failOn: 'warning', limitInputPixels: 25000000 });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) throw Error();
    const output = await image.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    if (output.length > 5242880) throw Error();
    return { bytes: output, mime, contentType: 'image/webp' as const };
  } catch { throw Error('Choose a valid, non-animated PNG, JPEG or WebP image up to 25 megapixels.'); }
}
