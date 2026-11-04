/**
 * QR Code Client Export and Download Utilities
 *
 * Supports:
 * - High-resolution 2048px PNG export with crisp contrast and white background via HTMLCanvasElement
 * - Vector SVG export
 * - Client-side download triggers
 *
 * Safe for client-side webpack bundling (no Node.js native dependencies).
 */

/**
 * Triggers a browser download of an SVG or PNG Blob.
 */
export function saveBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Client-side download of the QR code as an SVG file.
 */
export function downloadQrSvg(
  svgElementOrString: SVGSVGElement | string,
  filename: string,
): void {
  if (typeof window === "undefined") return;
  const svgString =
    typeof svgElementOrString === "string"
      ? svgElementOrString
      : new XMLSerializer().serializeToString(svgElementOrString);

  const blob = new Blob([svgString], {
    type: "image/svg+xml;charset=utf-8",
  });
  saveBlob(blob, filename.endsWith(".svg") ? filename : `${filename}.svg`);
}

/**
 * Client-side download of the QR code as a high-resolution 2048px PNG.
 * Renders on a clean, solid background with precise pixel alignment.
 */
export async function downloadQrPng(
  svgElementOrString: SVGSVGElement | string,
  filename: string,
  resolution: number = 2048,
): Promise<void> {
  if (typeof window === "undefined") return;

  const svgString =
    typeof svgElementOrString === "string"
      ? svgElementOrString
      : new XMLSerializer().serializeToString(svgElementOrString);

  const source = URL.createObjectURL(
    new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }),
  );

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(new Error("Could not rasterize QR code for PNG export."));
      img.src = source;
    });

    const canvas = document.createElement("canvas");
    canvas.width = resolution;
    canvas.height = resolution;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D export is not supported in this browser.");
    }

    // High contrast white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, resolution, resolution);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, resolution, resolution);

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error("PNG generation failed.")),
        "image/png",
      ),
    );

    saveBlob(blob, filename.endsWith(".png") ? filename : `${filename}.png`);
  } finally {
    URL.revokeObjectURL(source);
  }
}
