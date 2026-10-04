"use server";
import { z } from "zod";
import { prisma, type AppTransactionClient } from "@/utils/prisma";
import { requireClubPermission } from "@/utils/auth";
import { hasPermission } from "@/lib/permissions";
import { votingDisplaySchema, readVotingDisplay } from "@/lib/voting-presentation";
import { displayConfigSchema, readDisplayConfig, projectApplicantDisplay } from "@/lib/applicant-display";
const scope = z.object({ clubId: z.string().uuid(), applicationId: z.string().uuid(), sessionId: z.string().uuid().optional(), previewConfig: votingDisplaySchema.optional() });
async function authorized(tx: AppTransactionClient, input: z.infer<typeof scope>, membershipId: string) {
  const member = await tx.clubMember.findFirst({ where: { id: membershipId, clubId: input.clubId } });
  if (!hasPermission(member, "applications.review")) throw new Error("Review access required.");
  const app = await tx.application.findFirst({
    where: { id: input.applicationId, clubId: input.clubId, status: { not: "DRAFTING" } },
    include: { round: true, student: { include: { studentProfile: { include: { experiences: true } } } }, evaluations: true, answers: { include: { question: true } }, bookings: { include: { slot: true } } },
  });
  if (!app || (!app.round.anonymousReview && !hasPermission(member, "applicants.identify"))) throw new Error("Applicant unavailable for this reviewer.");
  return app;
}
export async function getApplicantDisplay(input: z.infer<typeof scope>) {
  const data = scope.parse(input);
  const { user, membership } = await requireClubPermission(data.clubId, ["applications.review"]);
  return prisma.$transaction(async tx => {
    const app = await authorized(tx, data, membership.id);
    const reviewer = await tx.clubMember.findFirst({where:{id:membership.id,clubId:data.clubId}});
    let config=readDisplayConfig(app.round.applicantDisplay);
    if(data.previewConfig){
      if(!hasPermission(reviewer,"decisions.manage"))throw Error("Voting setup permission required.");
      config=data.previewConfig;
    }
    if(data.sessionId){
      const voting = await tx.votingSession.findFirst({where:{id:data.sessionId,clubId:data.clubId},include:{participants:true,candidates:true}});
      if(!voting || !voting.candidates.some(c=>c.applicationId===app.id) || (!hasPermission(reviewer,"decisions.manage")&&!hasPermission(reviewer,"decisions.view")&&!(hasPermission(reviewer,"decisions.vote")&&voting.participants.some(p=>p.memberId===membership.id)))) throw Error("Voting presentation unavailable.");
      config=readVotingDisplay(voting.displayConfig);
    }
    const observations = app.round.anonymousReview ? [] : await tx.applicantObservation.findMany({ where: { applicationId: app.id }, include: { author: { select: { studentProfile: { select: { firstName: true, lastName: true } } } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return projectApplicantDisplay(app, app.round, config, observations.map(o => ({
      id: o.id, kind: o.kind, body: o.body, author: o.author.studentProfile ? `${o.author.studentProfile.firstName} ${o.author.studentProfile.lastName}` : "Club reviewer", own: o.authorId === user.id, createdAt: o.createdAt.toISOString(), updatedAt: o.updatedAt.toISOString(),
    })));
  }, { isolationLevel: "RepeatableRead" });
}
export async function saveApplicantObservation(input: unknown) {
  const data = scope.extend({ id: z.string().uuid().optional(), kind: z.enum(["PRO", "CON"]), body: z.string().trim().min(1).max(3000) }).strict().parse(input);
  const { user, membership } = await requireClubPermission(data.clubId, ["applications.review"]);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Application" WHERE id=${data.applicationId} FOR UPDATE`;
    const app = await authorized(tx, data, membership.id);
    // Free text can identify an applicant. Preserve existing observations without exposing them anonymously.
    if (app.round.anonymousReview) throw new Error("Pros and Cons are withheld during anonymous review.");
    if (data.id) {
      const changed = await tx.applicantObservation.updateMany({ where: { id: data.id, applicationId: app.id, authorId: user.id }, data: { body: data.body, kind: data.kind } });
      if (changed.count !== 1) throw new Error("Only the author can edit this observation.");
    } else {
      await tx.applicantObservation.create({ data: { applicationId: app.id, authorId: user.id, kind: data.kind, body: data.body, anonymousReview: false } });
    }
    await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: app.id, action: data.id ? "applicant.observation.update" : "applicant.observation.create" } });
    return { success: true };
  });
}
export async function deleteApplicantObservation(input: unknown) {
  const data = scope.extend({ id: z.string().uuid() }).strict().parse(input);
  const { user, membership } = await requireClubPermission(data.clubId, ["applications.review"]);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Application" WHERE id=${data.applicationId} FOR UPDATE`;
    const app = await authorized(tx, data, membership.id);
    if (app.round.anonymousReview) throw new Error("Pros and Cons are withheld during anonymous review.");
    const removed = await tx.applicantObservation.deleteMany({ where: { id: data.id, applicationId: app.id, authorId: user.id } });
    if (removed.count !== 1) throw new Error("Only the author can delete this observation.");
    await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: app.id, action: "applicant.observation.delete" } });
    return { success: true };
  });
}
export async function getApplicantDisplayConfiguration(clubId: string, roundId: string) {
  z.string().uuid().parse(roundId);
  await requireClubPermission(clubId, ["interviews.manage"]);
  const round = await prisma.pipelineRound.findFirst({ where: { id: roundId, clubId } });
  if (!round) throw new Error("Round unavailable.");
  return { config: readDisplayConfig(round.applicantDisplay), version: round.displayVersion };
}
export async function saveApplicantDisplayConfiguration(input: unknown) {
  const data = z.object({ clubId: z.string().uuid(), roundId: z.string().uuid(), version: z.number().int().min(0), config: displayConfigSchema }).strict().parse(input);
  const { user } = await requireClubPermission(data.clubId, ["interviews.manage"]);
  return prisma.$transaction(async tx => {
    const changed = await tx.pipelineRound.updateMany({ where: { id: data.roundId, clubId: data.clubId, displayVersion: data.version }, data: { applicantDisplay: data.config, displayVersion: { increment: 1 } } });
    if (changed.count !== 1) throw new Error("Configuration changed or round unavailable. Reload before saving.");
    await tx.auditLog.create({ data: { actorId: user.id, clubId: data.clubId, targetId: data.roundId, action: "applicant.display.configure" } });
    return { config: data.config, version: data.version + 1 };
  });
}
