/**
 * How the in-page résumé viewer can show a résumé reference.
 * Uploaded résumés are PDF-only (validateProfileFile) and reach the browser through the
 * server-authorized same-origin route /api/recruiting-resumes, so a same-origin path is a PDF.
 * Students may instead link an external résumé URL. Nothing is fetched from a third party
 * when the viewer opens: documents browsers cannot render (Word, Pages, RTF, OpenDocument)
 * offer Download, and every other external link, including images, offers Open link.
 */
export type ResumePreviewKind = "pdf" | "unsupported" | "external";
const documentExtensions = /\.(?:docx?|rtf|odt|pages|txt)$/i;

export function isSameOriginResumePath(href: string) {
  return href.startsWith("/") && !href.startsWith("//") && !href.includes("\\");
}

export function resumePreviewKind(href: string): ResumePreviewKind {
  if (isSameOriginResumePath(href)) {
    const path = href.split(/[?#]/)[0];
    return documentExtensions.test(path) ? "unsupported" : "pdf";
  }
  let path = "";
  try { path = new URL(href).pathname; } catch { return "external"; }
  if (documentExtensions.test(path)) return "unsupported";
  return "external";
}

/** A file name for the Download button; the route itself never exposes a Storage object name. */
export function resumeDownloadName(label: string) {
  const base = label.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
  return `${base || "resume"}.pdf`;
}
