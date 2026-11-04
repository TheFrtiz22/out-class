/**
 * Server-only QR Code Utilities
 *
 * Provides Node.js-only rasterization using sharp.
 */

import { generateOutClassQRSVG, type QRCodeRenderOptions } from "@/lib/qr/renderer";

/**
 * Server-side rasterization of a QR code to a PNG buffer using sharp.
 */
export async function generateQrPngBuffer(
  payload: string,
  options: QRCodeRenderOptions = {},
  resolution: number = 1024,
): Promise<Buffer> {
  const svg = generateOutClassQRSVG(payload, options);
  const sharp = (await import("sharp")).default;
  return sharp(Buffer.from(svg))
    .resize(resolution, resolution)
    .png()
    .toBuffer();
}
