"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma, type AppTransactionClient } from "@/utils/prisma";
import { requireClubPermission } from "@/utils/auth";
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization";
import { clubWriteTransaction } from "@/utils/club-write-transaction";
import { supportContext } from "@/utils/support-audit";
import { publishRecruitmentDecision } from "@/utils/recruitment-offers";
import { assertNotRecused } from "@/lib/recusal";
import { boundedParse } from "@/lib/bounded-input";
import { hasPermission } from "@/lib/permissions";
import { normalizeReviewRubric, reviewRubricSchema } from "@/lib/review-rubric";
import { resolveStagedTarget, stagedIsStale, stagedOutcomes, type StagedDecisionView } from "@/lib/staged-decisions";
import { anonymousApplicantLabel } from "@/lib/anonymous-review";
import { actionResult } from "@/lib/action-result";

/**
 * Review grading categories and staged decisions (lib/review-rubric.ts, lib/staged-decisions.ts).
 * Staging records an outcome only; nothing reaches the applicant until sendStagedDecisions, which applies
 * each one through the canonical decision publisher (offers, letters, notifications) or a round move.
 */
const uuid = z.string().uuid();
const decideCaps = ["decisions.manage", "applicants.identify"] as const;
const appStatus = z.enum(["SUBMITTED", "IN_REVIEW", "INTERVIEWING", "ACCEPTED", "REJECTED", "WAITLISTED"]);
const MAX_SEND = 200;

export async function getReviewRubric(clubId: string) {
  uuid.parse(clubId);
  const { membership } = await requireClubPermission(clubId, [], { allowSuspendedRead: true });
  if (!hasPermission(membership, "applications.review") && !hasPermission(membership, "recruitment.manage")) throw new Error("Applicant access denied.");
  const club = await prisma.club.findUniqueOrThrow({ where: { id: clubId }, select: { reviewRubric: true } });
  return { rubric: normalizeReviewRubric(club.reviewRubric), configured: club.reviewRubric != null };
}

const rubricInput = z.object({ clubId: uuid, rubric: reviewRubricSchema }).strict();
export async function saveReviewRubric(input: z.input<typeof rubricInput>) {
  const data = boundedParse(rubricInput, input);
  const { user } = await requireClubPermission(data.clubId, ["recruitment.manage"]);
  await clubWriteTransaction(async tx => {
    await authorizeClubTransaction(tx, data.clubId, user.id, ["recruitment.manage"]);
    await tx.club.update({ where: { id: data.clubId }, data: { reviewRubric: data.rubric } });
    await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: data.clubId, action: "club.review-rubric.change", details: { categories: data.rubric.categories.length } } });
  });
  revalidatePath("/", "layout");
  return { rubric: data.rubric };
}

type ViewRow = { id: string; applicationId: string; outcome: string; targetStatus: string; targetRoundId: string | null; expectedStatus: string; expectedRoundId: string; stagedById: string; createdAt: Date
  stagedBy: { user: { studentProfile: { firstName: string; lastName: string } | null } }
  application: { round: { name: string; anonymousReview: boolean }; student: { studentProfile: { firstName: string; lastName: string } | null } } }
function view(row: ViewRow, memberId: string, roundNames: ReadonlyMap<string, string>): StagedDecisionView {
  const profile = row.stagedBy.user.studentProfile, applicant = row.application.student.studentProfile;
  return {
    applicant: row.application.round.anonymousReview ? anonymousApplicantLabel(row.applicationId) : applicant ? `${applicant.firstName} ${applicant.lastName}` : "Applicant",
    roundName: row.application.round.name, targetRoundName: row.targetRoundId ? roundNames.get(row.targetRoundId) ?? null : null,
    id: row.id, applicationId: row.applicationId, outcome: row.outcome as StagedDecisionView["outcome"],
    targetStatus: row.targetStatus as StagedDecisionView["targetStatus"], targetRoundId: row.targetRoundId,
    expectedStatus: row.expectedStatus as StagedDecisionView["expectedStatus"], expectedRoundId: row.expectedRoundId,
    stagedBy: profile ? `${profile.firstName} ${profile.lastName}` : "Club reviewer", stagedByMe: row.stagedById === memberId, createdAt: row.createdAt.toISOString(),
  };
}
const name = { select: { firstName: true, lastName: true } } as const;
const viewSelect = { id: true, applicationId: true, outcome: true, targetStatus: true, targetRoundId: true, expectedStatus: true, expectedRoundId: true, stagedById: true, createdAt: true,
  stagedBy: { select: { user: { select: { studentProfile: name } } } },
  application: { select: { round: { select: { name: true, anonymousReview: true } }, student: { select: { studentProfile: name } } } } } as const;
const roundNames = async (tx: AppTransactionClient, clubId: string) => new Map((await tx.pipelineRound.findMany({ where: { clubId }, select: { id: true, name: true } })).map(round => [round.id, round.name]));

/** Every staged decision in the club (one per application). Decision managers only. */
export async function listStagedDecisions(clubId: string) {
  uuid.parse(clubId);
  const { user } = await requireClubPermission(clubId, [...decideCaps], { allowSuspendedRead: true });
  return prisma.$transaction(async tx => {
    const member = await authorizeClubTransaction(tx, clubId, user.id, decideCaps, { readOnly: true, allowSuspendedRead: true });
    const rows = await tx.stagedDecision.findMany({ where: { clubId }, select: viewSelect, orderBy: { createdAt: "asc" }, take: 5000 });
    const names = await roundNames(tx, clubId);
    return rows.map(row => view(row, member.id, names));
  });
}

const stageInput = z.object({
  clubId: uuid, applicationId: uuid, outcome: z.enum(stagedOutcomes), roundId: uuid.optional(),
  expectedStatus: appStatus, expectedRoundId: uuid,
}).strict();
/** Record (or replace) the staged decision for one applicant. Changes nothing the applicant can see. */
export async function stageDecision(input: z.input<typeof stageInput>) {
  const data = boundedParse(stageInput, input);
  const { user } = await requireClubPermission(data.clubId, [...decideCaps]);
  return clubWriteTransaction(async tx => {
    const member = await authorizeClubTransaction(tx, data.clubId, user.id, decideCaps, { sharedClubLock: true });
    await tx.$queryRaw`SELECT id FROM "Application" WHERE id=${data.applicationId} AND "clubId"=${data.clubId} FOR UPDATE`;
    const app = await tx.application.findFirst({ where: { id: data.applicationId, clubId: data.clubId }, select: { id: true, status: true, roundId: true, studentId: true } });
    if (!app || app.status === "DRAFTING") throw new Error("Application unavailable.");
    if (app.studentId === user.id) throw new Error("You can't decide your own application.");
    if (app.status !== data.expectedStatus || app.roundId !== data.expectedRoundId) throw new Error("Application changed. Reload the page and try again.");
    await assertNotRecused(tx, app.id, member.id);
    const rounds = await tx.pipelineRound.findMany({ where: { clubId: data.clubId, archivedAt: null }, select: { id: true, name: true, order: true, type: true } });
    const target = resolveStagedTarget(app, rounds, data.outcome, data.roundId);
    const values = { outcome: data.outcome, targetStatus: target.targetStatus, targetRoundId: target.targetRoundId, expectedStatus: app.status, expectedRoundId: app.roundId, stagedById: member.id };
    const row = await tx.stagedDecision.upsert({ where: { applicationId: app.id }, create: { clubId: data.clubId, applicationId: app.id, ...values }, update: values, select: viewSelect });
    await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: app.id, action: "recruitment.decision.staged", details: { outcome: data.outcome, targetStatus: target.targetStatus, targetRoundId: target.targetRoundId } } });
    return view(row, member.id, new Map(rounds.map(round => [round.id, round.name])));
  });
}

const clearInput = z.object({ clubId: uuid, applicationId: uuid, stagedId: uuid.optional() }).strict();
/** Remove a staged decision (Undo, or moving a card back). `stagedId` guards against clearing a newer one. */
export async function clearStagedDecision(input: z.input<typeof clearInput>) {
  const data = boundedParse(clearInput, input);
  const { user } = await requireClubPermission(data.clubId, [...decideCaps]);
  return clubWriteTransaction(async tx => {
    const member = await authorizeClubTransaction(tx, data.clubId, user.id, decideCaps, { sharedClubLock: true });
    await assertNotRecused(tx, data.applicationId, member.id);
    const result = await tx.stagedDecision.deleteMany({ where: { clubId: data.clubId, applicationId: data.applicationId, ...(data.stagedId ? { id: data.stagedId } : {}) } });
    if (result.count) await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: data.applicationId, action: "recruitment.decision.unstaged" } });
    return { cleared: result.count };
  });
}

const sendInput = z.object({ clubId: uuid, applicationIds: z.array(uuid).min(1).max(MAX_SEND), confirmed: z.literal(true) }).strict();
type SendResult = { sent: number; stale: { applicationId: string; reason: string }[] };
/**
 * Apply staged decisions. Each one is checked against the status and round it was made for; a changed
 * applicant is skipped (and stays staged) instead of applied. Final decisions publish through the canonical
 * decision publisher, exactly like an individual decision; round moves notify through the Application trigger.
 */
async function sendStagedDecisionsCommand(input: z.input<typeof sendInput>): Promise<SendResult> {
  const data = boundedParse(sendInput, input);
  const ids = [...new Set(data.applicationIds)].sort();
  const { user } = await requireClubPermission(data.clubId, [...decideCaps]);
  if (await supportContext()) throw new Error("Exit temporary support impersonation before sending decisions.");
  const result = await clubWriteTransaction(async tx => {
    const member = await authorizeClubTransaction(tx, data.clubId, user.id, decideCaps);
    const canMoveRounds = hasPermission(member, "recruitment.manage");
    await lockApplications(tx, data.clubId, ids);
    const staged = await tx.stagedDecision.findMany({ where: { clubId: data.clubId, applicationId: { in: ids } } });
    const apps = await tx.application.findMany({ where: { clubId: data.clubId, id: { in: ids } }, include: { round: true } });
    const rounds = await tx.pipelineRound.findMany({ where: { clubId: data.clubId, archivedAt: null }, select: { id: true, name: true, order: true, type: true } });
    const out: SendResult = { sent: 0, stale: [] };
    for (const item of staged) {
      const app = apps.find(candidate => candidate.id === item.applicationId);
      const skip = (reason: string) => out.stale.push({ applicationId: item.applicationId, reason });
      if (!app || app.status === "DRAFTING") { skip("no longer available"); continue }
      if (stagedIsStale(item, app)) { skip("changed since the decision was staged"); continue }
      if (app.studentId === user.id) { skip("is your own application"); continue }
      if (await tx.applicantRecusal.findFirst({ where: { applicationId: app.id, memberId: member.id, liftedAt: null }, select: { id: true } })) { skip("you have stepped out of reviewing this applicant"); continue }
      if (item.targetRoundId) {
        if (!canMoveRounds) { skip("moving rounds needs recruitment management access"); continue }
        const target = rounds.find(round => round.id === item.targetRoundId);
        if (!target) { skip("its target round is no longer active"); continue }
        await tx.application.update({ where: { id: app.id }, data: { roundId: target.id, status: item.targetStatus } });
        await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: app.id, action: "club.round.move", details: { staged: item.id, previousRoundId: app.roundId, newRoundId: target.id, previousStatus: app.status, status: item.targetStatus } } });
        // The Application notification trigger tells the applicant about the new round/status, as for any move.
      } else if (item.targetStatus !== app.status) {
        // Hold on an applicant already in review changes nothing; everything else publishes as a direct decision.
        await publishRecruitmentDecision(tx, { clubId: data.clubId, applicationId: app.id, status: item.targetStatus, expectedStatus: app.status, roundId: app.roundId }, user.id);
      }
      await tx.stagedDecision.delete({ where: { id: item.id } });
      await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: app.id, action: "recruitment.decision.staged.sent", details: { staged: item.id, outcome: item.outcome, targetStatus: item.targetStatus, targetRoundId: item.targetRoundId } } });
      out.sent++;
    }
    return out;
  });
  revalidatePath("/", "layout");
  return result;
}

async function lockApplications(tx: AppTransactionClient, clubId: string, ids: string[]) {
  for (const id of ids) await tx.$queryRaw`SELECT id FROM "Application" WHERE id=${id} AND "clubId"=${clubId} FOR UPDATE`;
}

/** Sending publishes decisions; refusals (e.g. an offer that changed) must reach the person who pressed Send. */
export async function sendStagedDecisions(input: z.input<typeof sendInput>) {
  return actionResult(() => sendStagedDecisionsCommand(input), "sendStagedDecisions");
}
