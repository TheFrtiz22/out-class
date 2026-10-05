import { anchorMatchesText, type ResumeAnchor } from "@/lib/resume-anchors";
import { dirname, join } from "node:path";

/** Called only after document/panel authorization, on immutable database bytes. No URL ingestion. */
export async function validateResumeAnchor(bytes: Uint8Array, anchor: ResumeAnchor) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const root = dirname(require.resolve("pdfjs-dist/package.json"));
  const assetPath = (folder: string) => join(root, folder).replaceAll("\\", "/") + "/";
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, useWorkerFetch: false, cMapUrl: assetPath("cmaps"), standardFontDataUrl: assetPath("standard_fonts") });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        const pdf = await task.promise;
        if (anchor.page > pdf.numPages) throw new Error("Highlight page unavailable.");
        const content = await (await pdf.getPage(anchor.page)).getTextContent();
        const text = content.items.map(item => "str" in item ? item.str : "").join("");
        if (!anchorMatchesText(anchor, text, pdf.numPages)) throw new Error("Highlight does not match the saved document.");
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Highlight validation timed out. Retry or use general notes.")), 8000); }),
    ]);
  } finally { clearTimeout(timer); await task.destroy(); }
}
