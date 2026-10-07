export type PhotoCrop = { zoom: number; x: number; y: number };
export const initialPhotoCrop: PhotoCrop = { zoom: 1, x: 0, y: 0 };
/** Offsets are normalized to the available overflow; the crop never contains empty pixels. */
export function photoCropRect(width: number, height: number, crop: PhotoCrop) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width * height > 80_000_000) throw Error("Choose an image with valid dimensions (up to 80 megapixels).");
  if (![crop.zoom, crop.x, crop.y].every(Number.isFinite) || crop.zoom < 1 || crop.zoom > 4 || Math.abs(crop.x) > 1 || Math.abs(crop.y) > 1) throw Error("Invalid crop.");
  const side = Math.min(width, height) / crop.zoom;
  return { sx: (width - side) / 2 * (1 + crop.x), sy: (height - side) / 2 * (1 + crop.y), side };
}
