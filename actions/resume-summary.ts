"use server";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { authorizeInterview, interviewTransactionOptions } from "@/utils/interview-access";
import { interviewScopeSchema } from "@/lib/interview-access";
import { readRecruitingResume } from "@/utils/recruiting-resume";
import { cachedResumeSummary, ResumeSummaryBusyError } from "@/utils/resume-summary";
import { resumeSummaryResult, type ResumeSummaryResult } from "@/lib/resume-summary";

const requestSchema = z.discriminatedUnion("kind", [
  interviewScopeSchema.extend({ kind: z.literal("interview"), documentId: z.string().uuid() }).strict(),
  z.object({ kind: z.literal("recruiting"), clubId: z.string().uuid(), applicationId: z.string().uuid() }).strict(),
]);
export type ResumeSummaryRequest = z.infer<typeof requestSchema>;

/**
 * The section summary of a résumé the caller may already open, authorized exactly like the PDF
 * routes: the interview snapshot (/api/interview-resumes) or the reviewer proxy
 * (/api/recruiting-resumes, which anonymous review never reaches). Errors carry no résumé content.
 */
export async function getResumeSummary(input: ResumeSummaryRequest): Promise<ResumeSummaryResult> {
  const data = requestSchema.parse(input);
  const { user } = await requireAuth();
  let source: { studentId: string; bytes: Uint8Array; contentHash?: string };
  try {
    if (data.kind === "interview") {
      const { kind: _kind, documentId, ...scope } = data;
      source = await prisma.$transaction(async tx => {
        const { app } = await authorizeInterview(tx, scope, user.id, "resume", "share");
        const document = await tx.interviewResumeDocument.findFirst({ where: { id: documentId, applicationId: scope.applicationId, roundId: scope.roundId }, select: { content: true, contentHash: true } });
        if (!document) throw new Error("Unavailable");
        return { studentId: app.studentId, bytes: new Uint8Array(document.content), contentHash: document.contentHash };
      }, interviewTransactionOptions);
    } else {
      const read = await readRecruitingResume(data.clubId, data.applicationId, user.id);
      if (!read.ok) throw new Error("Unavailable");
      source = read;
    }
  } catch { throw new Error("Résumé summary unavailable."); }
  try {
    return resumeSummaryResult(await cachedResumeSummary(source.studentId, source.bytes, { contentHash: source.contentHash }));
  } catch (error) {
    throw new Error(error instanceof ResumeSummaryBusyError ? error.message : "Résumé summary unavailable.");
  }
}
