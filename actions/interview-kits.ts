"use server";
import { anonymousApplicantLabel } from "@/lib/anonymous-review";

import { roundConfigurationSchema } from "@/lib/club-settings";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import type { AppTransactionClient } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { authorizeInterview, authorizeQuestionBank, interviewActor } from "@/utils/interview-access";
import { interviewScopeSchema as scope, interviewScoreSchema } from "@/lib/interview-access";
import { kitSchema, interviewDraftSchema, emptyInterviewDraft, validateQuestionNotes, type InterviewSessionData } from "@/lib/interview-kits";
import type { InterviewRecord } from "@prisma/client";

async function present(record: InterviewRecord, tx: AppTransactionClient): Promise<InterviewSessionData> {
  const draft = interviewDraftSchema.parse(record.draft);
  const canonical = record.completedAt && record.evaluationId ? await tx.evaluation.findUnique({ where: { id: record.evaluationId } }) : null;
  return { id: record.id, revision: record.revision, questions: kitSchema.parse(record.questions),
    draft: canonical ? { ...draft, score: canonical.score, overallReview: canonical.notes || "", additionalNotes: canonical.notes || "", applicantQuestions: canonical.applicantQuestions || "" } : draft,
    completedAt: record.completedAt?.toISOString() || null,
    feedbackSource: record.completedAt ? canonical ? "evaluation" : "historical-snapshot" : "draft" };
}
export async function getInterviewKit(clubId: string, roundId: string) {
  z.string().uuid().parse(clubId); z.string().uuid().parse(roundId);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { round } = await authorizeQuestionBank(tx, clubId, roundId, user.id);
    return { questions: kitSchema.parse(round.interviewKit), version: round.kitVersion };
  });
}
/** Narrow assignment-scoped queue: no academic metrics, answers or other reviewers' drafts. */
export async function getInterviewWorkspace(clubId: string) {
  z.string().uuid().parse(clubId); const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { member, caps } = await interviewActor(tx, clubId, user.id);
    if (!caps.participate) throw new Error("Identified interview access required.");
    const applications = await tx.application.findMany({ where: { clubId, studentId: { not: user.id }, status: { not: "DRAFTING" }, round: { anonymousReview: false }, interviewAssignments: { some: { memberId: member.id, revokedAt: null, round: { anonymousReview: false } } } }, select: {
      id: true, roundId: true, student: { select: { studentProfile: { select: { firstName: true, lastName: true } } } },
      interviewAssignments: { where: { memberId: member.id, revokedAt: null, round: { anonymousReview: false } }, select: { roundId: true } },
      interviewRecords: { where: { interviewerId: member.id, anonymousReview: false }, select: { roundId: true, completedAt: true } },
    } });
    const rounds = await tx.pipelineRound.findMany({ where: { clubId, anonymousReview: false, id: { in: applications.flatMap(a => a.interviewAssignments.map(s => s.roundId)) } }, orderBy: [{ order: "asc" }, { id: "asc" }], select: { id: true, name: true, archivedAt: true } });
    return { rounds: rounds.map(r => ({ id: r.id, name: r.name, archived: !!r.archivedAt })), applications: applications.map(a => ({ id: a.id, roundId: a.roundId, name: a.student.studentProfile ? `${a.student.studentProfile.firstName} ${a.student.studentProfile.lastName}` : "Profile not provided", assignedRoundIds: a.interviewAssignments.map(s => s.roundId), completedRoundIds: a.interviewRecords.filter(r => r.completedAt).map(r => r.roundId) })) };
  });
}
export async function saveInterviewKit(clubId: string, roundId: string, version: number, questions: unknown) {
  z.string().uuid().parse(clubId); z.string().uuid().parse(roundId);
  const parsed = kitSchema.parse(questions); z.number().int().min(0).parse(version);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    await authorizeQuestionBank(tx, clubId, roundId, user.id, true);
    const changed = await tx.pipelineRound.updateMany({ where: { id: roundId, clubId, archivedAt: null, kitVersion: version }, data: { interviewKit: parsed, kitVersion: { increment: 1 } } });
    if (changed.count !== 1) throw new Error("Kit changed. Reload before editing.");
    await tx.auditLog.create({ data: { actorId: user.id, clubId, targetId: roundId, action: "interview.kit.update", details: { version: version + 1, questionCount: parsed.length } } });
    return { questions: parsed, version: version + 1 };
  });
}
export async function openInterviewSession(input: z.infer<typeof scope>): Promise<InterviewSessionData> {
  const data = scope.parse(input); const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { app, round, member } = await authorizeInterview(tx, data, user.id);
    const key = { applicationId: app.id, roundId: round.id, interviewerId: member.id };
    let record = await tx.interviewRecord.findUnique({ where: { applicationId_interviewerId_roundId: key } });
    if (!record) {
      if (round.archivedAt) throw new Error("Archived rounds cannot start interviews.");
      if (app.roundId !== round.id) throw new Error("Cannot start an interview in a previous round.");
      record = await tx.interviewRecord.create({ data: { ...key, questions: kitSchema.parse(round.interviewKit), draft: emptyInterviewDraft, anonymousReview: false } });
    }
    if (record.anonymousReview) throw new Error("Historical anonymous interview is protected.");
    if (!record.completedAt && app.roundId !== round.id) throw new Error("Applicant round changed.");
    const settings = roundConfigurationSchema.parse(round.configuration || {});
    return { ...await present(record, tx), instructions: settings.instructions, duration: settings.duration };
  });
}
export async function saveInterviewSession(input: z.infer<typeof scope> & { revision: number; draft: unknown; complete?: boolean }) {
  const data = scope.extend({ revision: z.number().int().min(0), draft: interviewDraftSchema, complete: z.boolean().default(false) }).parse(input);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { app, round, member } = await authorizeInterview(tx, data, user.id);
    const key = { applicationId: app.id, roundId: round.id, interviewerId: member.id };
    const record = await tx.interviewRecord.findUnique({ where: { applicationId_interviewerId_roundId: key } });
    if (!record || record.anonymousReview) throw new Error("Interview unavailable under current privacy settings.");
    validateQuestionNotes(kitSchema.parse(record.questions), data.draft);
    if (!record.completedAt && round.archivedAt) throw new Error("Archived rounds retain history but cannot edit interviews.");
    if (record.completedAt) {
      // A lost success response can be retried, but only with exactly the submitted draft.
      if (!data.complete || data.revision !== record.revision - 1 || JSON.stringify(interviewDraftSchema.parse(record.draft)) !== JSON.stringify(data.draft)) throw new Error("This interview is already completed.");
      const evaluation = record.evaluationId ? await tx.evaluation.findUnique({ where: { id: record.evaluationId } }) : null;
      return { session: await present(record, tx), evaluation };
    }
    if (app.roundId !== round.id) throw new Error("Applicant round changed. Reload the workspace.");
    if (record.revision !== data.revision) throw new Error("A newer draft exists. Reload before saving.");
    if (data.draft.score !== null) interviewScoreSchema.parse(data.draft.score);
    const oldDraft = interviewDraftSchema.parse(record.draft);
    // Off-script IDs are durable: a later request cannot change or remove their prompts.
    if (oldDraft.additionalQuestions.some(q => !data.draft.additionalQuestions.some(n => n.id === q.id && n.question === q.question))) throw new Error("Existing off-script question IDs and prompts must be preserved.");
    let evaluation = null;
    const submittedAt = data.complete ? new Date() : null;
    if (data.complete) {
      const score = interviewScoreSchema.parse(data.draft.score);
      // Unknown historical rounds need reconciliation, never name-based matching or duplicates.
      if (await tx.evaluation.findFirst({ where: { applicationId: app.id, interviewerId: member.id, roundId: null } })) throw new Error("Historical evaluation needs explicit round reconciliation before submission.");
      evaluation = await tx.evaluation.upsert({ where: { applicationId_interviewerId_roundId: key },
        create: { ...key, round: round.name, score, notes: data.draft.additionalNotes ?? data.draft.overallReview, applicantQuestions: data.draft.applicantQuestions || "", submittedAt },
        update: { score, notes: data.draft.additionalNotes ?? data.draft.overallReview, applicantQuestions: data.draft.applicantQuestions || "", submittedAt } });
    }
    const changed = await tx.interviewRecord.updateMany({ where: { id: record.id, revision: data.revision, completedAt: null }, data: { draft: data.draft, revision: { increment: 1 }, completedAt: submittedAt, ...(evaluation ? { evaluationId: evaluation.id } : {}) } });
    if (changed.count !== 1) throw new Error("A newer draft exists. Reload before saving.");
    if (data.complete) await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: record.id, action: "interview.complete" } });
    return { session: await present((await tx.interviewRecord.findUniqueOrThrow({ where: { id: record.id } })), tx), evaluation };
  });
}
export async function getInterviewRounds(clubId: string) {
  z.string().uuid().parse(clubId); const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { member, caps } = await interviewActor(tx, clubId, user.id);
    return tx.pipelineRound.findMany({ where: { clubId, ...(!caps.editKit ? { interviewAssignments: { some: { memberId: member.id, revokedAt: null } } } : {}) }, select: { id: true, name: true }, orderBy: { order: "asc" } });
  });
}
/** Closing projection deliberately never includes questions or private draft notes. */
/** Leadership discovery returns metadata only; opening a review reauthorizes its scope. */
export async function getSubmittedInterviewReviews(clubId: string) {
  z.string().uuid().parse(clubId);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { caps } = await interviewActor(tx, clubId, user.id);
    if (!caps.readClosing) throw new Error("Explicit leadership review access required.");
    const records = await tx.interviewRecord.findMany({
      where: { completedAt: { not: null }, round: { clubId }, application: { clubId, studentId: { not: user.id }, status: { not: "DRAFTING" } } },
      orderBy: [{ completedAt: "desc" }, { id: "desc" }], take: 100,
      select: { id: true, applicationId: true, roundId: true, interviewerId: true, anonymousReview: true, round: { select: { name: true, anonymousReview: true } }, application: { select: { round: { select: { anonymousReview: true } }, student: { select: { studentProfile: { select: { firstName: true, lastName: true } } } } } } },
    });
    return records.map(r => { const anonymous = !!(r.anonymousReview || r.round.anonymousReview || r.application.round.anonymousReview); return { id: r.id, applicationId: r.applicationId, roundId: r.roundId, interviewerId: r.interviewerId, anonymous, roundName: anonymous ? "Interview review" : r.round.name, applicantName: anonymous ? anonymousApplicantLabel(r.applicationId) : r.application.student.studentProfile ? `${r.application.student.studentProfile.firstName} ${r.application.student.studentProfile.lastName}` : "Profile not provided" }; });
  });
}
export async function getSubmittedInterviewReview(input: z.infer<typeof scope> & { interviewerId: string }) {
  const data = scope.extend({ interviewerId: z.string().uuid() }).parse(input); const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { member, caps, anonymous: scopeAnonymous } = await authorizeInterview(tx, data, user.id, "closingReview");
    if (data.interviewerId !== member.id && !caps.readClosing) throw new Error("Leadership review access required.");
    const record = await tx.interviewRecord.findUnique({ where: { applicationId_interviewerId_roundId: { applicationId: data.applicationId, roundId: data.roundId, interviewerId: data.interviewerId } }, include: { evaluation: true } });
    if (!record?.completedAt || (record.anonymousReview && !caps.readClosing)) throw new Error("Submitted review unavailable.");
    const anonymous = scopeAnonymous || record.anonymousReview;
    const draft = interviewDraftSchema.parse(record.draft);
    return { id: record.id, interviewerId: record.interviewerId, roundId: record.roundId, anonymous, textUnavailable: anonymous, submittedAt: anonymous ? null : record.completedAt.toISOString(), score: record.evaluation?.score ?? draft.score,
      applicantQuestions: anonymous ? "" : record.evaluation?.applicantQuestions ?? draft.applicantQuestions ?? "", additionalNotes: anonymous ? "" : record.evaluation?.notes ?? draft.additionalNotes ?? draft.overallReview, readOnly: true as const };
  });
}
export async function getPreviousInterviewScores(input: z.infer<typeof scope>) {
  const data = scope.parse(input); const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { member } = await authorizeInterview(tx, data, user.id);
    const records = await tx.interviewRecord.findMany({ where: {
      interviewerId: member.id, roundId: data.roundId, applicationId: { not: data.applicationId }, completedAt: { not: null }, anonymousReview: false, evaluationId: { not: null },
      round: { clubId: data.clubId, anonymousReview: false },
      application: { clubId: data.clubId, studentId: { not: user.id }, status: { not: "DRAFTING" }, round: { anonymousReview: false }, interviewAssignments: { some: { memberId: member.id, roundId: data.roundId, revokedAt: null } } },
    }, orderBy: [{ completedAt: "desc" }, { id: "desc" }], take: 5,
    select: { id: true, evaluation: { select: { score: true } }, application: { select: { student: { select: { studentProfile: { select: { firstName: true, lastName: true } } } } } } } });
    return records.map(r => ({ id: r.id, name: r.application.student.studentProfile ? `${r.application.student.studentProfile.firstName} ${r.application.student.studentProfile.lastName}` : "Profile not provided", score: r.evaluation!.score }));
  });
}
