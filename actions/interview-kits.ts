"use server";
import { ActionError, actionResult } from "@/lib/action-result";
import { validateFinalInterviewThoughts } from "@/lib/interview-final-thoughts";
import { anonymousApplicantLabel } from "@/lib/anonymous-review";

import { roundConfigurationSchema } from "@/lib/club-settings";
import { z } from "zod";
import { prisma } from "@/utils/prisma";
import type { AppTransactionClient } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { authorizeInterview, authorizeQuestionBank, interviewActionResult, interviewActor, interviewTransactionOptions } from "@/utils/interview-access";
import { interviewScopeSchema as scope, interviewScoreSchema, interviewCapabilities } from "@/lib/interview-access";
import { hasPermission } from "@/lib/permissions";
import { profilePhotoSource } from "@/lib/profile-photo";
import { kitSchema, interviewDraftSchema, emptyInterviewDraft, validateQuestionNotes, validateAdditionalQuestionSnapshots, type InterviewSessionData } from "@/lib/interview-kits";
import type { InterviewRecord, Prisma } from "@prisma/client";
import type { ApplicantInterviewFilters } from "@/lib/applicant-interview-navigation";
import { STALE_INTERVIEW_LIST_CURSOR, decodeInterviewListCursor, interviewListFiltersSchema, interviewListLimitSchema, interviewListPage, interviewListScope } from "@/lib/interview-list-page";
import { approvedBookingPanel, collaborationAccess } from "@/utils/interview-collaboration";
import { interviewTiming } from "@/lib/interview-session-timing";
import { interviewHistoryWindow, previousApplicantScores } from "@/lib/interview-score-history";
import { canReadRoundScore, snapshotSubmittedQuestions, submittedQuestionsSchema, submittedScoreSummary, type ListRoundScore } from "@/lib/interview-review-summary";
import { canDiscoverInterviewSetup, type InterviewSetupRounds } from "@/lib/interview-setup";
import { CLUB_SUSPENDED_MESSAGE } from "@/lib/club-suspension";
import { boundedParse } from "@/lib/bounded-input";

async function present(record: InterviewRecord, tx: AppTransactionClient): Promise<InterviewSessionData> {
  const draft = interviewDraftSchema.parse(record.draft);
  const canonical = record.completedAt && record.evaluationId ? await tx.evaluation.findUnique({ where: { id: record.evaluationId } }) : null;
  return { id: record.id, revision: record.revision, questions: kitSchema.parse(record.questions),
    draft: canonical ? { ...draft, score: canonical.score, overallReview: canonical.notes || "", additionalNotes: canonical.notes || "", applicantQuestions: canonical.applicantQuestions || "" } : draft,
    completedAt: record.completedAt?.toISOString() || null,
    feedbackSource: record.completedAt ? canonical ? "evaluation" : "historical-snapshot" : "draft" };
}
async function getInterviewKitCommand(clubId: string, roundId: string) {
  z.string().uuid().parse(clubId); z.string().uuid().parse(roundId);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { round } = await authorizeQuestionBank(tx, clubId, roundId, user.id);
    return { questions: kitSchema.parse(round.interviewKit), version: round.kitVersion };
  }, interviewTransactionOptions);
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
  }, interviewTransactionOptions);
}
async function saveInterviewKitCommand(clubId: string, roundId: string, version: number, questions: unknown) {
  z.string().uuid().parse(clubId); z.string().uuid().parse(roundId);
  const parsed = boundedParse(kitSchema, questions); z.number().int().min(0).parse(version);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    await authorizeQuestionBank(tx, clubId, roundId, user.id, true);
    const changed = await tx.pipelineRound.updateMany({ where: { id: roundId, clubId, archivedAt: null, kitVersion: version }, data: { interviewKit: parsed, kitVersion: { increment: 1 } } });
    if (changed.count !== 1) throw new ActionError("Kit changed. Reload before editing.", "STALE");
    await tx.auditLog.create({ data: { actorId: user.id, clubId, targetId: roundId, action: "interview.kit.update", details: { version: version + 1, questionCount: parsed.length } } });
    return { questions: parsed, version: version + 1 };
  }, interviewTransactionOptions);
}
async function openInterviewSessionCommand(input: z.infer<typeof scope>): Promise<InterviewSessionData> {
  const data = scope.parse(input); const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { app, round, member } = await authorizeInterview(tx, data, user.id);
    const key = { applicationId: app.id, roundId: round.id, interviewerId: member.id };
    let record = await tx.interviewRecord.findUnique({ where: { applicationId_interviewerId_roundId: key } });
    const booking = await tx.interviewBooking.findUnique({ where: { applicationId_roundId: { applicationId: app.id, roundId: round.id } }, include: { slot: { include: { room: true, panelScheduleVersion: true } } } });
    const room = booking?.slot.room;
    const inRoom = !booking || !!(await approvedBookingPanel(tx, data, booking))?.includes(member.id);
    if (!record) {
      if (round.archivedAt) throw new ActionError("Archived rounds cannot start interviews.", "CLOSED");
      if (app.roundId !== round.id) throw new ActionError("Cannot start an interview in a previous round.");
      const common = inRoom ? await tx.interviewCollaboration.findUnique({ where: { applicationId_roundId_roomKey: { applicationId: app.id, roundId: round.id, roomKey: booking ? `booking:${booking.id}:${room!.id}` : `panel:${app.id}` } } }) : null;
      // A later panel member joins the same preserved bank, even if the master
      // kit changed since the first participant opened this candidate's room.
      record = await tx.interviewRecord.create({ data: { ...key, questions: kitSchema.parse(common?.questions ?? round.interviewKit), draft: emptyInterviewDraft, anonymousReview: false } });
    }
    if (record.anonymousReview) throw new ActionError("Historical anonymous interview is protected.", "FORBIDDEN");
    if (!record.completedAt && app.roundId !== round.id) throw new ActionError("Applicant round changed. Reload the workspace.", "STALE");
    const settings = roundConfigurationSchema.safeParse(round.configuration || {});
    const timing = inRoom ? interviewTiming(data, round.configuration, booking) : null;
    return { ...await present(record, tx), instructions: settings.success ? settings.data.instructions : "", duration: timing ? timing.durationMs / 60000 : undefined, timing };
  }, interviewTransactionOptions);
}
async function saveInterviewSessionCommand(input: z.infer<typeof scope> & { revision: number; draft: unknown; complete?: boolean }) {
  const data = boundedParse(scope.extend({ revision: z.number().int().min(0), draft: interviewDraftSchema, complete: z.boolean().default(false) }), input);
  const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { app, round, member } = await authorizeInterview(tx, data, user.id);
    const key = { applicationId: app.id, roundId: round.id, interviewerId: member.id };
    const record = await tx.interviewRecord.findUnique({ where: { applicationId_interviewerId_roundId: key } });
    if (!record || record.anonymousReview) throw new ActionError("Interview unavailable under current privacy settings.", "FORBIDDEN");
    validateQuestionNotes(kitSchema.parse(record.questions), data.draft);
    if (!record.completedAt && round.archivedAt) throw new ActionError("Archived rounds retain history but cannot edit interviews.", "CLOSED");
    if (record.completedAt) {
      // A lost success response can be retried, but only with exactly the submitted draft.
      if (!data.complete || data.revision !== record.revision - 1 || JSON.stringify(interviewDraftSchema.parse(record.draft)) !== JSON.stringify(data.draft)) throw new ActionError("This interview is already completed. Reload to see the submitted review.", "CLOSED");
      const evaluation = record.evaluationId ? await tx.evaluation.findUnique({ where: { id: record.evaluationId } }) : null;
      return { session: await present(record, tx), evaluation };
    }
    if (app.roundId !== round.id) throw new ActionError("Applicant round changed. Reload the workspace.", "STALE");
    if (record.revision !== data.revision) throw new ActionError("A newer draft exists. Reload before saving.", "STALE");
    if (data.draft.score !== null) interviewScoreSchema.parse(data.draft.score);
    const oldDraft = interviewDraftSchema.parse(record.draft);
    let allowedBank = kitSchema.parse(round.interviewKit);
    if (data.draft.additionalQuestions.some(q => q.bankQuestion && !oldDraft.additionalQuestions.some(old => old.id === q.id) && !allowedBank.some(source => source.id === q.id && source.prompt === q.question && source.guidance === q.bankQuestion!.guidance))) {
      const { roomKey } = await collaborationAccess(tx, data, user.id);
      const shared = await tx.interviewCollaboration.findUnique({ where: { applicationId_roundId_roomKey: { applicationId: app.id, roundId: round.id, roomKey } } });
      if (shared) allowedBank = [...allowedBank, ...kitSchema.parse(shared.questions)];
    }
    validateAdditionalQuestionSnapshots(oldDraft, data.draft, allowedBank);
    let evaluation = null;
    const submittedAt = data.complete ? new Date() : null;
    if (data.complete) {
      validateFinalInterviewThoughts(data.draft.finalInterviewThoughts);
      const score = interviewScoreSchema.parse(data.draft.score);
      // Unknown historical rounds need reconciliation, never name-based matching or duplicates.
      if (await tx.evaluation.findFirst({ where: { applicationId: app.id, interviewerId: member.id, roundId: null } })) throw new ActionError("Historical evaluation needs explicit round reconciliation before submission.");
      evaluation = await tx.evaluation.upsert({ where: { applicationId_interviewerId_roundId: key },
        create: { ...key, round: round.name, score, notes: data.draft.additionalNotes ?? data.draft.overallReview, applicantQuestions: data.draft.applicantQuestions || "", submittedAt, ...(data.draft.rubricScores ? { rubricScores: data.draft.rubricScores } : {}) },
        update: { score, notes: data.draft.additionalNotes ?? data.draft.overallReview, applicantQuestions: data.draft.applicantQuestions || "", submittedAt, ...(data.draft.rubricScores ? { rubricScores: data.draft.rubricScores } : {}) } });
    }
    const changed = await tx.interviewRecord.updateMany({ where: { id: record.id, revision: data.revision, completedAt: null }, data: { draft: data.draft, revision: { increment: 1 }, completedAt: submittedAt, ...(evaluation ? { evaluationId: evaluation.id, submittedQuestions: snapshotSubmittedQuestions(kitSchema.parse(record.questions), data.draft) } : {}) } });
    if (changed.count !== 1) throw new ActionError("A newer draft exists. Reload before saving.", "STALE");
    if (data.complete) await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: record.id, action: "interview.complete" } });
    return { session: await present((await tx.interviewRecord.findUniqueOrThrow({ where: { id: record.id } })), tx), evaluation };
  }, interviewTransactionOptions);
}
/** Application ID is the immutable recruitment record: final decisions cannot be reopened.
 * Never look up history by student, display round name, or a later application. */
async function getEarlierInterviewReviewsCommand(input: unknown) {
  const data = scope.parse(input); const { user } = await requireAuth({ verifyEmail: true });
  return prisma.$transaction(async tx => {
    const access = await authorizeInterview(tx, data, user.id, "panel", "share");
    if (access.app.roundId !== data.roundId) throw new ActionError("Current later-round assignment required.");
    await collaborationAccess(tx, data, user.id);
    const current = await tx.pipelineRound.findUniqueOrThrow({ where: { id: data.roundId } });
    const records = await tx.interviewRecord.findMany({ where: { applicationId: data.applicationId, completedAt: { not: null }, anonymousReview: false, round: { clubId: data.clubId, order: { lt: current.order }, anonymousReview: false }, evaluation: { submittedAt: { not: null } } }, include: { round: true, evaluation: true, interviewer: { include: { user: { select: { studentProfile: { select: { firstName: true, lastName: true } } } } } } }, orderBy: [{ round: { order: "asc" } }, { completedAt: "desc" }, { id: "desc" }] });
    return records.flatMap(r => {
      const e = r.evaluation;
      if (!e || e.applicationId !== data.applicationId || e.roundId !== r.roundId || e.interviewerId !== r.interviewerId || r.interviewer.clubId !== data.clubId) return [];
      const parsed = submittedQuestionsSchema.safeParse(r.submittedQuestions);
      const p = r.interviewer.user.studentProfile;
      return [{ id: r.id, roundId: r.roundId, roundName: r.round.name, reviewer: p ? `${p.firstName} ${p.lastName}` : "Interviewer", submittedAt: e.submittedAt!.toISOString(), questions: parsed.success ? parsed.data : null, additionalNotes: e.notes || "", applicantQuestions: e.applicantQuestions || "", finalInterviewThoughts: interviewDraftSchema.safeParse(r.draft).data?.finalInterviewThoughts || "", score: e.score }];
    });
  }, interviewTransactionOptions);
}

async function getInterviewRoundScoreCommand(input: unknown) {
  const data = scope.parse(input); const { user } = await requireAuth({ verifyEmail: true });
  return prisma.$transaction(async tx => {
    const access = await authorizeInterview(tx, data, user.id, "closingReview", "share");
    const own = await tx.evaluation.findUnique({ where: { applicationId_interviewerId_roundId: { applicationId: data.applicationId, interviewerId: access.member.id, roundId: data.roundId } } });
    // Independent scoring applies to leaders who also participate in this round.
    const assignment = await tx.interviewPanelAssignment.findUnique({ where: { applicationId_roundId_memberId: { applicationId: data.applicationId, roundId: data.roundId, memberId: access.member.id } } });
    if (!canReadRoundScore({ readClosing: access.caps.readClosing, currentRound: access.app.roundId === data.roundId, assigned: !!assignment && !assignment.revokedAt, ownSubmitted: !!own?.submittedAt })) throw new ActionError("Submit your own review before viewing round scores.");
    const evaluations = await tx.evaluation.findMany({ where: { applicationId: data.applicationId, roundId: data.roundId, submittedAt: { not: null }, stableRound: { clubId: data.clubId }, interviewer: { clubId: data.clubId } }, orderBy: [{ submittedAt: "desc" }, { id: "desc" }] });
    const assignments = await tx.interviewPanelAssignment.findMany({ where: { applicationId: data.applicationId, roundId: data.roundId, revokedAt: null, member: { clubId: data.clubId, status: "ACTIVE", user: { disabledAt: null } } }, include: { member: true } });
    return submittedScoreSummary(evaluations, assignments.filter(a => interviewCapabilities(a.member).participate).map(a => a.memberId));
  }, interviewTransactionOptions);
}
/** Round scores for one list page, batched (three queries per page, not per row) and gated
 * exactly like getInterviewRoundScore for a leadership viewer: recused applicants and a
 * current-round panel seat without the viewer's own submitted review get null. */
async function listRoundScores(tx: AppTransactionClient, clubId: string, memberId: string, rows: { applicationId: string; roundId: string; currentRoundId: string }[]) {
  const scores = new Map<string, ListRoundScore | null>();
  if (!rows.length) return scores;
  const applicationIds = [...new Set(rows.map(r => r.applicationId))], roundIds = [...new Set(rows.map(r => r.roundId))];
  const recused = new Set((await tx.applicantRecusal.findMany({ where: { applicationId: { in: applicationIds }, memberId, liftedAt: null }, select: { applicationId: true } })).map(r => r.applicationId));
  const evaluations = await tx.evaluation.findMany({ where: { applicationId: { in: applicationIds }, roundId: { in: roundIds }, submittedAt: { not: null }, stableRound: { clubId }, interviewer: { clubId } }, select: { applicationId: true, roundId: true, interviewerId: true, score: true, submittedAt: true } });
  const assignments = await tx.interviewPanelAssignment.findMany({ where: { applicationId: { in: applicationIds }, roundId: { in: roundIds }, revokedAt: null, application: { clubId } }, include: { member: { include: { user: { select: { disabledAt: true } } } } } });
  for (const row of rows) {
    const key = `${row.applicationId}:${row.roundId}`;
    if (scores.has(key)) continue;
    const pair = <T extends { applicationId: string; roundId: string | null }>(r: T) => r.applicationId === row.applicationId && r.roundId === row.roundId;
    const reviews = evaluations.filter(pair), panel = assignments.filter(pair);
    const visible = !recused.has(row.applicationId) && canReadRoundScore({ readClosing: true, currentRound: row.currentRoundId === row.roundId, assigned: panel.some(a => a.memberId === memberId), ownSubmitted: reviews.some(e => e.interviewerId === memberId) });
    if (!visible) { scores.set(key, null); continue; }
    const participants = panel.filter(a => a.member.clubId === clubId && a.member.status === "ACTIVE" && !a.member.user.disabledAt && interviewCapabilities(a.member).participate).map(a => a.memberId);
    const { average, submitted } = submittedScoreSummary(reviews.map(e => ({ interviewerId: e.interviewerId, score: e.score, submittedAt: e.submittedAt })), participants);
    scores.set(key, { average, submitted });
  }
  return scores;
}
export async function getInterviewRounds(clubId: string): Promise<InterviewSetupRounds> {
  z.string().uuid().parse(clubId); const { user } = await requireAuth();
  try { return await prisma.$transaction(async tx => {
    const { member, caps } = await interviewActor(tx, clubId, user.id);
    const discover = canDiscoverInterviewSetup(member);
    if (!discover && !caps.participate) return { status: "denied", rounds: [] };
    const assignment = { memberId: member.id, revokedAt: null, application: { clubId, studentId: { not: user.id }, status: { not: "DRAFTING" as const } } };
    const rounds = await tx.pipelineRound.findMany({
      where: { clubId, archivedAt: null, type: { in: ["INTERVIEW", "GROUP_INTERVIEW"] }, ...(!discover ? { interviewAssignments: { some: assignment } } : {}) },
      select: { id: true, name: true, interviewAssignments: { where: assignment, select: { id: true }, take: 1 } },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    });
    return { status: "ready", rounds: rounds.map(r => ({ id: r.id, name: r.name, canReadKit: caps.editKit || caps.participate && r.interviewAssignments.length > 0 })) };
  }, interviewTransactionOptions); } catch (error) {
    // Only confirmed authorization denials become denial state. Database/network
    // failures remain failures, never an empty list or a reason to create a round.
    if (error instanceof Error && ["Interview access unavailable.", CLUB_SUSPENDED_MESSAGE].includes(error.message)) return { status: "denied", rounds: [] };
    throw error;
  }
}
/** Closing projection deliberately never includes questions or private draft notes. */
/** Leadership discovery returns metadata only; opening a review reauthorizes its scope. */
async function readSubmittedInterviewReviews(clubId: string, filters: ApplicantInterviewFilters, cursor: unknown, withTotal: boolean, limit?: unknown) {
  z.string().uuid().parse(clubId);
  const { user, impersonation } = await requireAuth();
  // Round scores need the same verified identity as getInterviewRoundScore; a support view
  // whose target cannot be verified still gets the list, without scores.
  const scoresAllowed = !impersonation || await requireAuth({ verifyEmail: true }).then(() => true, () => false);
  const selected = interviewListFiltersSchema.parse(filters), take = interviewListLimitSchema.parse(limit);
  const listScope = interviewListScope(clubId, selected);
  const position = decodeInterviewListCursor(cursor, "reviews", listScope);
  return prisma.$transaction(async tx => {
    // Every page re-checks live leadership access before reading anything.
    const { caps, member } = await interviewActor(tx, clubId, user.id);
    if (!caps.readClosing) throw new ActionError("Explicit leadership review access required.", "FORBIDDEN");
    // Photos follow the identified-CRM rule the photo route re-checks (applicants.identify, non-anonymous).
    const identify = hasPermission(member, "applicants.identify");
    const where: Prisma.InterviewRecordWhereInput = { ...(selected.applicationId ? { applicationId: selected.applicationId } : {}), ...(selected.roundId ? { roundId: selected.roundId } : {}), completedAt: { not: null }, round: { clubId }, application: { ...(selected.cycleId ? { recruitmentCycleId: selected.cycleId } : {}), clubId, studentId: { not: user.id }, status: { not: "DRAFTING" } } };
    let page = where;
    if (position) {
      // The anchor must satisfy this request's own authorized filters; a cursor never widens scope.
      const anchor = await tx.interviewRecord.findFirst({ where: { AND: [where, { id: position.id }] }, select: { completedAt: true } });
      if (!anchor?.completedAt) throw new Error(STALE_INTERVIEW_LIST_CURSOR);
      page = { AND: [where, { OR: [{ completedAt: { lt: anchor.completedAt } }, { completedAt: anchor.completedAt, id: { lt: position.id } }] }] };
    }
    const records = await tx.interviewRecord.findMany({
      where: page,
      orderBy: [{ completedAt: "desc" }, { id: "desc" }], take: take + 1,
      select: { id: true, applicationId: true, roundId: true, interviewerId: true, anonymousReview: true, round: { select: { name: true, anonymousReview: true } }, application: { select: { roundId: true, round: { select: { anonymousReview: true } }, student: { select: { studentProfile: { select: { firstName: true, lastName: true, headshotUrl: true } } } } } } },
    });
    const total = withTotal ? await tx.interviewRecord.count({ where }) : 0;
    const scores = scoresAllowed ? await listRoundScores(tx, clubId, member.id, records.slice(0, take).map(r => ({ applicationId: r.applicationId, roundId: r.roundId, currentRoundId: r.application.roundId }))) : new Map<string, ListRoundScore | null>();
    const rows = records.map(r => { const anonymous = !!(r.anonymousReview || r.round.anonymousReview || r.application.round.anonymousReview); return { id: r.id, applicationId: r.applicationId, roundId: r.roundId, interviewerId: r.interviewerId, anonymous, roundName: anonymous ? "Interview review" : r.round.name, applicantName: anonymous ? anonymousApplicantLabel(r.applicationId) : r.application.student.studentProfile ? `${r.application.student.studentProfile.firstName} ${r.application.student.studentProfile.lastName}` : "Profile not provided", photo: anonymous || !identify ? null : profilePhotoSource(r.application.student.studentProfile?.headshotUrl, { clubId, applicationId: r.applicationId, mode: "crm" }) ?? null, score: scores.get(`${r.applicationId}:${r.roundId}`) ?? null }; });
    return interviewListPage(rows, r => r.id, "reviews", listScope, total, take);
  }, interviewTransactionOptions);
}
/** One page (50) of submitted reviews, newest first. `cursor` is the previous page's `nextCursor`;
 * `limit` (up to 500) lets a refresh re-read everything already loaded in one request. */
async function getSubmittedInterviewReviewPageCommand(clubId: string, filters: ApplicantInterviewFilters = {}, cursor: string | null = null, limit?: number) {
  return readSubmittedInterviewReviews(clubId, filters, cursor, true, limit);
}
/** Earlier array contract: the first page only. The leadership UI pages with getSubmittedInterviewReviewPage. */
async function getSubmittedInterviewReviewsCommand(clubId: string, filters: ApplicantInterviewFilters = {}) {
  return (await readSubmittedInterviewReviews(clubId, filters, null, false)).items;
}
async function getSubmittedInterviewReviewCommand(input: z.infer<typeof scope> & { interviewerId: string }) {
  const data = scope.extend({ interviewerId: z.string().uuid() }).parse(input); const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { member, caps, panel, app, anonymous: scopeAnonymous } = await authorizeInterview(tx, data, user.id, "closingReview");
    if (data.interviewerId !== member.id && !caps.readClosing) throw new ActionError("Leadership review access required.", "FORBIDDEN");
    if (data.interviewerId !== member.id && panel && app.roundId === data.roundId) {
      const own = await tx.evaluation.findUnique({ where: { applicationId_interviewerId_roundId: { applicationId: data.applicationId, roundId: data.roundId, interviewerId: member.id } } });
      if (!own?.submittedAt) throw new ActionError("Submit your own review before viewing peers' reviews.");
    }
    const record = await tx.interviewRecord.findUnique({ where: { applicationId_interviewerId_roundId: { applicationId: data.applicationId, roundId: data.roundId, interviewerId: data.interviewerId } }, include: { evaluation: true } });
    if (!record?.completedAt || (record.anonymousReview && !caps.readClosing)) throw new ActionError("Submitted review unavailable.", "NOT_FOUND");
    const anonymous = scopeAnonymous || record.anonymousReview;
    const draft = interviewDraftSchema.parse(record.draft);
    return { id: record.id, interviewerId: record.interviewerId, roundId: record.roundId, anonymous, textUnavailable: anonymous, submittedAt: anonymous ? null : record.completedAt.toISOString(), score: record.evaluation?.score ?? draft.score,
      finalInterviewThoughts: anonymous ? "" : draft.finalInterviewThoughts || "",
      applicantQuestions: anonymous ? "" : record.evaluation?.applicantQuestions ?? draft.applicantQuestions ?? "", additionalNotes: anonymous ? "" : record.evaluation?.notes ?? draft.additionalNotes ?? draft.overallReview, readOnly: true as const };
  }, interviewTransactionOptions);
}
async function getPreviousInterviewScoresCommand(input: z.infer<typeof scope>) {
  const data = scope.parse(input); const { user } = await requireAuth();
  return prisma.$transaction(async tx => {
    const { member, caps } = await authorizeInterview(tx, data, user.id);
    const current = await tx.interviewBooking.findUnique({ where: { applicationId_roundId: { applicationId: data.applicationId, roundId: data.roundId } }, include: { slot: { include: { room: true } } } });
    const room = current?.slot.room;
    if (!current || !room || room.clubId !== data.clubId || room.roundId !== data.roundId) return [];
    const window = interviewHistoryWindow(current.slot.startTime);
    const bookings = await tx.interviewBooking.findMany({ where: {
      roundId: data.roundId, applicationId: { not: data.applicationId },
      slot: { clubId: data.clubId, roomId: room.id, startTime: { gte: window.start, lt: current.slot.startTime } },
      application: { clubId: data.clubId, studentId: { not: user.id }, status: { not: "DRAFTING" }, round: { anonymousReview: false },
        ...(!caps.readClosing ? { interviewAssignments: { some: { memberId: member.id, roundId: data.roundId, revokedAt: null } } } : {}) },
    }, select: { applicationId: true, application: { select: { roundId: true, student: { select: { studentProfile: { select: { firstName: true, lastName: true } } } }, interviewAssignments: { where: { memberId: member.id, roundId: data.roundId, revokedAt: null }, select: { id: true } } } } } });
    const allRecords = bookings.length ? await tx.interviewRecord.findMany({ where: { applicationId: { in: bookings.map(b => b.applicationId) }, roundId: data.roundId, completedAt: { not: null }, evaluationId: { not: null }, round: { clubId: data.clubId, anonymousReview: false }, interviewer: { clubId: data.clubId } }, select: { id: true, applicationId: true, interviewerId: true, anonymousReview: true, evaluation: { select: { score: true, submittedAt: true } } } }) : [];
    const applicants = [];
    for (const booking of bookings) {
      const records = allRecords.filter(r => r.applicationId === booking.applicationId);
      // Match the canonical round-score visibility gate; never reveal peers early.
      if (records.some(r => r.anonymousReview)) continue;
      const own = records.some(r => r.interviewerId === member.id && r.evaluation?.submittedAt);
      if ((!caps.readClosing || booking.application.roundId === data.roundId && booking.application.interviewAssignments.length > 0) && !own) continue;
      const p = booking.application.student.studentProfile;
      applicants.push({ id: booking.applicationId, name: p ? `${p.firstName} ${p.lastName}` : "Profile not provided", reviews: records.flatMap(r => r.evaluation ? [{ id: r.id, interviewerId: r.interviewerId, score: r.evaluation.score, submittedAt: r.evaluation.submittedAt }] : []) });
    }
    return previousApplicantScores(applicants);
  }, interviewTransactionOptions);
}

export async function getInterviewKit(...args: Parameters<typeof getInterviewKitCommand>) {
  return actionResult(() => getInterviewKitCommand(...args), "getInterviewKit")
}

export async function saveInterviewKit(...args: Parameters<typeof saveInterviewKitCommand>) {
  return actionResult(() => saveInterviewKitCommand(...args), "saveInterviewKit")
}

// Room actions: an access denial (e.g. removed from the panel mid-interview) is a typed ACCESS_REVOKED refusal.
export async function openInterviewSession(...args: Parameters<typeof openInterviewSessionCommand>) {
  return interviewActionResult(() => openInterviewSessionCommand(...args), "openInterviewSession")
}

export async function saveInterviewSession(...args: Parameters<typeof saveInterviewSessionCommand>) {
  return interviewActionResult(() => saveInterviewSessionCommand(...args), "saveInterviewSession")
}

export async function getEarlierInterviewReviews(...args: Parameters<typeof getEarlierInterviewReviewsCommand>) {
  return interviewActionResult(() => getEarlierInterviewReviewsCommand(...args), "getEarlierInterviewReviews")
}

export async function getInterviewRoundScore(...args: Parameters<typeof getInterviewRoundScoreCommand>) {
  return interviewActionResult(() => getInterviewRoundScoreCommand(...args), "getInterviewRoundScore")
}

export async function getSubmittedInterviewReviewPage(...args: Parameters<typeof getSubmittedInterviewReviewPageCommand>) {
  return actionResult(() => getSubmittedInterviewReviewPageCommand(...args), "getSubmittedInterviewReviewPage")
}
export async function getSubmittedInterviewReviews(...args: Parameters<typeof getSubmittedInterviewReviewsCommand>) {
  return actionResult(() => getSubmittedInterviewReviewsCommand(...args), "getSubmittedInterviewReviews")
}

export async function getSubmittedInterviewReview(...args: Parameters<typeof getSubmittedInterviewReviewCommand>) {
  return interviewActionResult(() => getSubmittedInterviewReviewCommand(...args), "getSubmittedInterviewReview")
}

export async function getPreviousInterviewScores(...args: Parameters<typeof getPreviousInterviewScoresCommand>) {
  return interviewActionResult(() => getPreviousInterviewScoresCommand(...args), "getPreviousInterviewScores")
}
