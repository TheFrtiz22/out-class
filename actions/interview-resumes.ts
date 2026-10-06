"use server";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { authorizeInterview, interviewActor } from "@/utils/interview-access";
import { interviewScopeSchema as scope, annotationContentSchema } from "@/lib/interview-access";
import { isPrivateResume, validateProfileFile } from "@/lib/student-profile";
import { validateResumeAnchor } from "@/lib/resume-anchor-validation";

const documentSelect = { id: true, contentHash: true, mimeType: true, createdAt: true } as const;
/** Explicit moderation entry point includes only preserved documents, never private question drafts. */
export async function getInterviewResumeModerationQueue(clubId: string) {
  z.string().uuid().parse(clubId); const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { caps } = await interviewActor(tx, clubId, user.id);
    if (!caps.moderateResume) throw new Error("President or vice-president moderation access required.");
    const documents = await tx.interviewResumeDocument.findMany({
      where: { application: { clubId, studentId: { not: user.id }, status: { not: "DRAFTING" }, round: { anonymousReview: false } }, round: { clubId, anonymousReview: false } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
      select: { id: true, applicationId: true, roundId: true, round: { select: { name: true } }, application: { select: { student: { select: { studentProfile: { select: { firstName: true, lastName: true } } } } } } },
    });
    return documents.map(d => ({ documentId: d.id, clubId, applicationId: d.applicationId, roundId: d.roundId, roundName: d.round.name, applicantName: d.application.student.studentProfile ? `${d.application.student.studentProfile.firstName} ${d.application.student.studentProfile.lastName}` : "Profile not provided" }));
  });
}
export async function getInterviewApplicantPanel(input: z.infer<typeof scope>) {
  const data = scope.parse(input); const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { app } = await authorizeInterview(tx, data, user.id);
    const profile = await tx.studentProfile.findUnique({ where: { userId: app.studentId }, select: { firstName: true, lastName: true, headshotUrl: true, scholarStatus: true } });
    const document = await tx.interviewResumeDocument.findUnique({ where: { applicationId_roundId: { applicationId: app.id, roundId: data.roundId } }, select: documentSelect });
    return { profile, document };
  });
}
/** Snapshot bytes once; neither profile replacement nor student object deletion changes this version. */
export async function pinInterviewResume(input: z.infer<typeof scope>) {
  const data = scope.parse(input); const { user } = await requireAuth();
  const initial = await prisma.$transaction(async tx => {
    const { app } = await authorizeInterview(tx, data, user.id, "resume");
    const existing = await tx.interviewResumeDocument.findUnique({ where: { applicationId_roundId: { applicationId: app.id, roundId: data.roundId } }, select: documentSelect });
    if (existing) return { existing, path: null };
    if (app.roundId !== data.roundId) throw new Error("Cannot snapshot a replacement resume for a past round.");
    const profile = await tx.studentProfile.findUnique({ where: { userId: app.studentId }, select: { resumeUrl: true } });
    if (!profile?.resumeUrl || !isPrivateResume(profile.resumeUrl) || !profile.resumeUrl.startsWith(`${app.studentId}/`)) throw new Error("Upload a private PDF before pinning an interview resume. External URLs are not snapshotted.");
    return { existing: null, path: profile.resumeUrl };
  });
  if (initial.existing) return initial.existing;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Private resume storage unavailable.");
  const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", secret, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
  const { data: bucket, error: bucketError } = await storage.getBucket("resumes");
  if (bucketError || !bucket || bucket.public) throw new Error("Private resume storage unavailable.");
  const { data: blob, error } = await storage.from("resumes").download(initial.path!);
  if (error || !blob || blob.size > 10 * 1024 * 1024) throw new Error("Resume unavailable or too large.");
  const bytes = new Uint8Array(await blob.arrayBuffer()); validateProfileFile(bytes, blob.type, "resume");
  const hash = createHash("sha256").update(bytes).digest("hex");
  return prisma.$transaction(async tx => {
    const { app } = await authorizeInterview(tx, data, user.id, "resume");
    const key = { applicationId: app.id, roundId: data.roundId };
    const existing = await tx.interviewResumeDocument.findUnique({ where: { applicationId_roundId: key }, select: documentSelect });
    if (existing) return existing;
    if (app.roundId !== data.roundId) throw new Error("Applicant round changed while pinning resume.");
    const document = await tx.interviewResumeDocument.create({ data: { ...key, sourcePath: initial.path!, contentHash: hash, content: bytes }, select: documentSelect });
    await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: document.id, action: "interview.resume.pin" } });
    return document;
  });
}
const documentScope = scope.extend({ documentId: z.string().uuid() });
export async function getInterviewResumeAnnotations(input: z.infer<typeof documentScope>) {
  const data = documentScope.parse(input); const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { member, caps } = await authorizeInterview(tx, data, user.id, "resume");
    const document = await tx.interviewResumeDocument.findFirst({ where: { id: data.documentId, applicationId: data.applicationId, roundId: data.roundId }, select: documentSelect });
    if (!document) throw new Error("Document unavailable.");
    const annotations = await tx.interviewResumeAnnotation.findMany({ where: { documentId: document.id, deletedAt: null }, include: { author: { select: { user: { select: { studentProfile: { select: { firstName: true, lastName: true } } } } } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return { document, annotations: annotations.map(({ author, ...a }) => ({ ...a, authorName: author.user.studentProfile ? `${author.user.studentProfile.firstName} ${author.user.studentProfile.lastName}` : "Club interviewer", canEdit: a.authorId === member.id || caps.moderateResume })) };
  });
}
export async function saveInterviewResumeAnnotation(input: unknown) {
  const data = documentScope.extend({ id: z.string().uuid(), revision: z.number().int().min(0).optional(), content: annotationContentSchema }).strict().parse(input);
  const { user } = await requireAuth();
  if (data.content.anchor) {
    const bytes = await prisma.$transaction(async tx => {
      await authorizeInterview(tx, data, user.id, "resume");
      const document = await tx.interviewResumeDocument.findFirst({ where: { id: data.documentId, applicationId: data.applicationId, roundId: data.roundId }, select: { content: true } });
      if (!document) throw new Error("Document unavailable.");
      return document.content;
    });
    // PDF parsing holds no database locks; the write transaction reauthorizes afterward.
    await validateResumeAnchor(bytes, data.content.anchor);
  }
  return prisma.$transaction(async tx => {
    const { member, caps } = await authorizeInterview(tx, data, user.id, "resume");
    const document = await tx.interviewResumeDocument.findFirst({ where: { id: data.documentId, applicationId: data.applicationId, roundId: data.roundId }, select: { id: true } });
    if (!document) throw new Error("Document unavailable.");
    const old = await tx.interviewResumeAnnotation.findUnique({ where: { id: data.id } });
    if (old && (old.documentId !== data.documentId || old.deletedAt || (old.authorId !== member.id && !caps.moderateResume))) throw new Error("Annotation unavailable.");
    if (old && data.revision === undefined) {
      if (old.authorId === member.id && old.revision === 0 && JSON.stringify(annotationContentSchema.parse({ kind: old.kind, anchor: old.anchor, comment: old.comment })) === JSON.stringify(data.content)) return { id: old.id, revision: old.revision };
      throw new Error("Annotation already exists; supply its revision.");
    }
    if (!old && data.revision !== undefined) throw new Error("Annotation unavailable.");
    if (old) {
      if (old.revision !== data.revision) throw new Error("Annotation changed. Reload before editing.");
      await tx.interviewAnnotationRevision.create({ data: { annotationId: old.id, actorId: user.id, revision: old.revision, content: { kind: old.kind, anchor: old.anchor, comment: old.comment, deletedAt: null } } });
      const changed = await tx.interviewResumeAnnotation.updateMany({ where: { id: old.id, revision: data.revision, deletedAt: null }, data: { ...data.content, anchor: data.content.anchor ?? Prisma.DbNull, revision: { increment: 1 } } });
      if (changed.count !== 1) throw new Error("Annotation changed. Reload before editing.");
    } else await tx.interviewResumeAnnotation.create({ data: { id: data.id, documentId: data.documentId, authorId: member.id, ...data.content, anchor: data.content.anchor ?? Prisma.DbNull } });
    await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: data.id, action: old ? "interview.annotation.edit" : "interview.annotation.create", details: { moderated: !!old && old.authorId !== member.id, revision: old ? old.revision + 1 : 0 } } });
    return { id: data.id, revision: old ? old.revision + 1 : 0 };
  });
}
export async function deleteInterviewResumeAnnotation(input: unknown) {
  const data = documentScope.extend({ id: z.string().uuid(), revision: z.number().int().min(0) }).strict().parse(input); const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { member, caps } = await authorizeInterview(tx, data, user.id, "resume");
    const old = await tx.interviewResumeAnnotation.findFirst({ where: { id: data.id, documentId: data.documentId, document: { applicationId: data.applicationId, roundId: data.roundId } } });
    if (!old || old.deletedAt || (old.authorId !== member.id && !caps.moderateResume)) throw new Error("Annotation unavailable.");
    if (old.revision !== data.revision) throw new Error("Annotation changed. Reload before deleting.");
    await tx.interviewAnnotationRevision.create({ data: { annotationId: old.id, actorId: user.id, revision: old.revision, content: { kind: old.kind, anchor: old.anchor, comment: old.comment, deleted: true } } });
    const changed = await tx.interviewResumeAnnotation.updateMany({ where: { id: old.id, revision: data.revision, deletedAt: null }, data: { deletedAt: new Date(), revision: { increment: 1 } } });
    if (changed.count !== 1) throw new Error("Annotation changed. Reload before deleting.");
    await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: old.id, action: "interview.annotation.delete", details: { moderated: old.authorId !== member.id, revision: old.revision + 1 } } });
    return { id: old.id, deleted: true };
  });
}
/** Original moderated text is not included in general audit logs or normal panel responses. */
export async function getInterviewAnnotationHistory(input: unknown) {
  const data = documentScope.extend({ id: z.string().uuid() }).parse(input); const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { member, caps } = await authorizeInterview(tx, data, user.id, "resume");
    const annotation = await tx.interviewResumeAnnotation.findFirst({ where: { id: data.id, documentId: data.documentId, document: { applicationId: data.applicationId, roundId: data.roundId } } });
    if (!annotation || (annotation.authorId !== member.id && !caps.moderateResume)) throw new Error("Annotation history unavailable.");
    return tx.interviewAnnotationRevision.findMany({ where: { annotationId: annotation.id }, orderBy: { revision: "asc" } });
  });
}
