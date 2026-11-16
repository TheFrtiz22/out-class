import { createHash } from "node:crypto";
import { after } from "next/server";
import { prisma } from "@/utils/prisma";
import { extractPdfText, pdfExtractionIdle } from "@/lib/resume-pdf";
import { RESUME_SUMMARY_MAX_BYTES, RESUME_SUMMARY_PARSER_VERSION, resumeSummarySchema, summarizeResumeText, type ResumeSummary } from "@/lib/resume-summary";

/** Retry later: the PDF pool is busy or timed out. Nothing is cached for these. */
export class ResumeSummaryBusyError extends Error { constructor() { super("Résumé summary is busy. Try again shortly."); } }
const TRANSIENT = /busy|too long|exceeded its resources/i;

export const resumeContentHash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/**
 * The summary of one résumé file, from the cache when this parser version has seen it, otherwise
 * extracted (lib/resume-pdf.ts caps and pool) and stored. Callers authorize first; `userId` is the
 * résumé's owner, so account deletion removes the row. Summary text is never logged or reported.
 */
export async function cachedResumeSummary(userId: string, bytes: Uint8Array, options: { contentHash?: string; extract?: (bytes: Uint8Array) => Promise<string> } = {}): Promise<ResumeSummary> {
  const contentHash = options.contentHash && /^[0-9a-f]{64}$/.test(options.contentHash) ? options.contentHash : resumeContentHash(bytes);
  const key = { userId, contentHash, parserVersion: RESUME_SUMMARY_PARSER_VERSION };
  const hit = await prisma.resumeSummary.findUnique({ where: { userId_contentHash_parserVersion: key }, select: { summary: true } });
  const cached = hit && resumeSummarySchema.safeParse(hit.summary);
  if (cached?.success) return cached.data;
  let text = "";
  try { text = await (options.extract ?? extractPdfText)(bytes); }
  catch (error) {
    if (error instanceof Error && TRANSIENT.test(error.message)) throw new ResumeSummaryBusyError();
    // Malformed, locked, too long: cached as unreadable so the file is not parsed again.
  }
  let summary = summarizeResumeText(text);
  if (Buffer.byteLength(JSON.stringify(summary)) > RESUME_SUMMARY_MAX_BYTES) summary = summarizeResumeText("");
  try {
    await prisma.resumeSummary.createMany({ data: [{ ...key, summary, confidence: summary.confidence }], skipDuplicates: true });
    await prisma.resumeSummary.deleteMany({ where: { userId, contentHash, parserVersion: { lt: RESUME_SUMMARY_PARSER_VERSION } } });
  } catch { /* The cache is an optimization; the summary is still returned. */ }
  return summary;
}

/** Best-effort, after the response: never delays or fails the caller, and yields to live requests. */
export function warmResumeSummary(userId: string, bytes: Uint8Array, contentHash?: string) {
  try {
    after(async () => { if (pdfExtractionIdle()) await cachedResumeSummary(userId, bytes, { contentHash }).catch(() => {}); });
  } catch { /* Outside a request (scripts, tests) there is nothing to defer to. */ }
}
