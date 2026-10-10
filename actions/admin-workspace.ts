"use server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { inspectPlatformRecord } from "@/actions/platform-admin";
import { prisma } from "@/utils/prisma";
import { requirePlatformAdmin } from "@/utils/platform-admin";
import { requireAuth } from "@/utils/auth";
import { isUvaEmail } from "@/lib/auth";
import { createClient as providerClient } from "@supabase/supabase-js";
import { createOrganizationAndInvitePresident } from "@/actions/platform-organization-onboarding";
import { createClubIdentityInvitation } from "@/actions/club-onboarding";
import { sendStudentClaimEmail, invitationEmailConfig } from "@/utils/email";
import { randomUUID } from "node:crypto";
import { enqueueInvitationEmail } from "@/utils/invitation-delivery";
import { scheduleInvitationDelivery } from "@/utils/invitation-background";
import { createIdentityInvitationInTransaction } from "@/utils/club-onboarding";
const reasonSchema = z.string().trim().min(10).max(1000);
const uuid = z.string().uuid();
const statuses = z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "DISMISSED"]);
function adminAuth() {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw Error("Account invitations are not configured.");
  return providerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function getAdminOverview() {
  const actor = await requirePlatformAdmin(), now = new Date();
  const [students, clubs, eventApprovals, clubApprovals, reports, upcomingEvents, supportItems] = await Promise.all([
    prisma.user.count(), prisma.club.count(), prisma.eventPublication.count({ where: { status: "PENDING" } }),
    prisma.clubClaim.count({ where: { status: "PENDING" } }),
    prisma.platformReport.count({ where: { kind: { not: "SUPPORT" }, status: { in: ["OPEN", "INVESTIGATING"] } } }),
    prisma.meeting.count({ where: { date: { gte: now }, publication: { is: { status: "PUBLISHED" } } } }),
    prisma.platformReport.count({ where: { kind: "SUPPORT", status: { in: ["OPEN", "INVESTIGATING"] } } }),
  ]);
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "platform.overview.read", targetId: "overview", details: { result: "success" } } });
  return { students, clubs, eventApprovals, clubApprovals, reports, upcomingEvents, supportItems };
}
export async function listAdminReports(input: unknown) {
  const actor = await requirePlatformAdmin();
  const f = z.object({ query: z.string().trim().max(200).default(""), status: z.union([statuses, z.literal("")]).default(""), support: z.boolean().default(false) }).strict().parse(input);
  const rows = await prisma.platformReport.findMany({ where: { kind: f.support ? "SUPPORT" : { not: "SUPPORT" }, ...(f.status ? { status: f.status } : {}), ...(f.query ? { OR: [{ summary: { contains: f.query, mode: "insensitive" } }, { targetId: { contains: f.query, mode: "insensitive" } }] } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 100 });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "platform.reports.read", targetId: "reports", details: { support: f.support, result: "success" } } });
  return rows;
}
export async function submitPlatformReport(input: unknown) {
  const { user } = await requireAuth();
  const d = z.object({ kind: z.enum(["USER", "CLUB", "EVENT", "CONTENT", "SUPPORT"]), targetId: z.string().trim().min(1).max(200), summary: z.string().trim().min(10).max(2000) }).strict().parse(input);
  if (d.kind !== "SUPPORT") {
    const exists = d.kind === "USER" ? await prisma.user.findUnique({ where: { id: d.targetId }, select: { id: true } }) : d.kind === "CLUB" ? await prisma.club.findUnique({ where: { id: d.targetId }, select: { id: true } }) : d.kind === "EVENT" ? await prisma.meeting.findUnique({ where: { id: d.targetId }, select: { id: true } }) : await prisma.platformContent.findUnique({ where: { key: d.targetId }, select: { id: true } });
    if (!exists) throw Error("Report target unavailable.");
  }
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
    if (await tx.platformReport.count({ where: { reporterId: user.id, createdAt: { gte: new Date(Date.now() - 3600000) } } }) >= 10) throw Error("Too many reports. Try again later.");
    const report = await tx.platformReport.create({ data: { ...d, reporterId: user.id } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "platform.report.create", targetId: report.id, details: { kind: d.kind, result: "success" } } });
    return { id: report.id };
  });
}
export async function resolveAdminReport(input: unknown) {
  const actor = await requirePlatformAdmin();
  const d = z.object({ id: uuid, revision: z.number().int().min(0), status: statuses, reason: reasonSchema }).strict().parse(input);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "PlatformReport" WHERE id=${d.id} FOR UPDATE`;
    const row = await tx.platformReport.findUnique({ where: { id: d.id } });
    if (!row || row.revision !== d.revision) throw Error("Report changed. Reload it before resolving.");
    const closed = ["RESOLVED", "DISMISSED"].includes(d.status);
    await tx.platformReport.update({ where: { id: d.id }, data: { status: d.status, resolution: d.reason, revision: { increment: 1 }, resolvedAt: closed ? new Date() : null, resolvedBy: closed ? actor.id : null } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "platform.report.resolve", targetId: d.id, reason: d.reason, details: { from: row.status, to: d.status, result: "success" } } });
    return { success: true };
  });
}
export async function inspectAdminClub(clubId: string, reason: string) {
  const actor = await requirePlatformAdmin(); uuid.parse(clubId); reasonSchema.parse(reason);
  const club = await prisma.club.findUnique({ where: { id: clubId }, include: {
    members: { include: { user: { select: { id: true, email: true, studentProfile: { select: { firstName: true, lastName: true } } } } }, take: 100 },
    invitations: { select: { id: true, email: true, requestedRole: true, status: true, acceptedAt: true, expiresAt: true, lastEmailSentAt: true }, take: 100 },
    claims: { take: 100 }, events: { select: { id: true, title: true, date: true, publication: { select: { status: true } } }, take: 100 },
    _count: { select: { applications: true, members: true } },
  } });
  const activity = await prisma.auditLog.findMany({ where: { clubId }, orderBy: { createdAt: "desc" }, take: 30 });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "platform.club.inspect", targetId: clubId, clubId, reason, details: { result: "success" } } });
  return { club, activity };
}
export async function setAdminClubSuspended(clubId: string, suspended: boolean, reason: string) {
  const actor = await requirePlatformAdmin(); uuid.parse(clubId); z.boolean().parse(suspended); reasonSchema.parse(reason);
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${clubId} FOR UPDATE`;
    await tx.club.update({ where: { id: clubId }, data: { suspendedAt: suspended ? new Date() : null } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "platform.club.suspension", targetId: clubId, clubId, reason, details: { suspended, result: "success" } } });
  });
  revalidateTag("club-directory");
  revalidatePath(`/club/${clubId}`);
  revalidatePath(`/club/${clubId}/workspace`);
  revalidatePath("/corkboard");
}
const settingsSchema = z.object({ supportEmail: z.union([z.string().email().max(254), z.literal("")]).default(""), campusNotice: z.string().trim().max(500).default(""), maintenanceNotice: z.string().trim().max(500).default("") }).strict();
export async function getAdminSettings() {
  const actor = await requirePlatformAdmin();
  const row = await prisma.platformContent.findUnique({ where: { key: "platform:settings" } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "platform.settings.read", targetId: "platform:settings", details: { result: "success" } } });
  return settingsSchema.parse(row?.value || {});
}
export async function saveAdminSettings(input: unknown, reason: string) {
  const actor = await requirePlatformAdmin(), value = settingsSchema.parse(input); reasonSchema.parse(reason);
  await prisma.$transaction(async tx => {
    await tx.platformContent.upsert({ where: { key: "platform:settings" }, create: { key: "platform:settings", value }, update: { value } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "platform.settings.change", targetId: "platform:settings", reason, details: { result: "success", fields: Object.keys(value) } } });
  });
}
const studentSchema = z.object({ email: z.string().trim().toLowerCase().email().refine(isUvaEmail), firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100), major: z.string().trim().max(120).optional(), gradYear: z.number().int().min(2000).max(2100).optional(), clubId: uuid.optional(), reason: reasonSchema }).strict();
export async function createAdminStudent(input: unknown) {
  const actor = await requirePlatformAdmin(), d = studentSchema.parse(input);
  const config = invitationEmailConfig();
  if (await prisma.user.findFirst({ where: { email: { equals: d.email, mode: "insensitive" } } })) throw Error("An account already exists. Inspect it in Users before resending an invitation.");
  const relationship = d.clubId ? await prisma.club.findUniqueOrThrow({ where: { id: d.clubId }, include: { school: { include: { identifierTypes: true } } } }) : null;
  const relationshipType = relationship?.school.identifierTypes.find(t => t.verification === "EMAIL_LOCAL_PART" && t.emailDomain === "virginia.edu");
  if (relationship && (!relationshipType || !relationship.school.active || relationship.suspendedAt)) throw Error("Choose an active club configured for UVA invitations.");
  const client = adminAuth();
  // Provider owns expiry, token hashing, intended email binding and single-use verification.
  // There is no password field and no second invitation/token model.
  const invitation = await client.auth.admin.generateLink({ type: "invite", email: d.email, options: { data: { first_name: d.firstName, last_name: d.lastName, firstName: d.firstName, lastName: d.lastName, major: d.major, gradYear: d.gradYear } } });
  if (invitation.error || !invitation.data.user) throw Error("Could not provision the student invitation.");
  const userId = invitation.data.user.id;
  await prisma.user.upsert({ where: { id: userId }, create: { id: userId, email: d.email }, update: {} });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "platform.student.invitation.create", targetId: userId, reason: d.reason, details: { result: "created", email: d.email } } });
  if (d.major && d.gradYear && /^[a-z][a-z0-9]{1,31}$/.test(d.email.split("@")[0])) await prisma.studentProfile.create({ data: { userId, firstName: d.firstName, lastName: d.lastName, computingId: d.email.split("@")[0], major: d.major, gradYear: d.gradYear } });
  if (relationship && relationshipType) await createClubIdentityInvitation({ clubId: relationship.id, identifierTypeId: relationshipType.id, identifier: d.email.split("@")[0], invitedName: `${d.firstName} ${d.lastName}`, requestedRole: "MEMBER", platformDesignation: true });
  const receipt = await sendStudentClaimEmail({ recipient: d.email, name: d.firstName, tokenHash: invitation.data.properties.hashed_token, deliveryId: randomUUID(), siteUrl: config.siteUrl });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "platform.student.invitation.sent", targetId: userId, details: { result: "accepted_by_smtp", providerMessageId: receipt.messageId } } });
  return { id: userId, email: d.email, status: "INVITED" };
}
export async function resendAdminStudentInvitation(userId: string, reason: string) {
  const actor = await requirePlatformAdmin(); uuid.parse(userId); reasonSchema.parse(reason);
  const config = invitationEmailConfig(), client = adminAuth();
  const { data, error } = await client.auth.admin.getUserById(userId);
  if (error || !data.user?.email || !isUvaEmail(data.user.email) || !data.user.invited_at || data.user.email_confirmed_at) throw Error("Only unclaimed UVA invitations can be resent.");
  // Reserve the attempt before token generation/SMTP. Failed or ambiguous sends
  // and concurrent Admin requests must respect the same resend cooldown.
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    if (await tx.auditLog.count({ where: { targetId: userId, action: { in: ["platform.student.invitation.create", "platform.student.invitation.sent", "platform.student.invitation.resend", "platform.student.invitation.resend-attempt"] }, createdAt: { gte: new Date(Date.now() - 15 * 60000) } } })) throw Error("Wait 15 minutes before resending.");
    await tx.auditLog.create({ data: { actorId: actor.id, action: "platform.student.invitation.resend-attempt", targetId: userId, reason, details: { result: "attempt" } } });
  });
  const link = await client.auth.admin.generateLink({ type: "invite", email: data.user.email });
  if (link.error) throw Error("Could not renew the invitation.");
  const receipt = await sendStudentClaimEmail({ recipient: data.user.email, name: String(data.user.user_metadata.firstName || "Student"), tokenHash: link.data.properties.hashed_token, deliveryId: randomUUID(), siteUrl: config.siteUrl });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "platform.student.invitation.resend", targetId: userId, reason, details: { result: "accepted_by_smtp", providerMessageId: receipt.messageId } } });
  return { success: true };
}
export async function createAdminClub(input: unknown) {
  await requirePlatformAdmin();
  const d = z.object({ organization: z.object({ requestId: uuid, identifierTypeId: z.string().min(1), organizationName: z.string(), presidentName: z.string(), presidentIdentifier: z.string(), presidentYear: z.string(), reason: reasonSchema }), leaderEmail: z.string().trim().toLowerCase().email(), description: z.string().trim().max(2000), category: z.string().trim().min(1).max(100), organizationInfo: z.string().trim().max(2000).default(""), additionalLeaders: z.array(z.object({ email: z.string().trim().toLowerCase().email(), name: z.string().min(1).max(200) })).max(10).default([]) }).strict().parse(input);
  invitationEmailConfig();
  const mapping = await prisma.schoolIdentifierType.findUniqueOrThrow({ where: { id: d.organization.identifierTypeId } });
  const addresses = [d.leaderEmail, ...d.additionalLeaders.map(l => l.email)];
  if (mapping.verification !== "EMAIL_LOCAL_PART" || !mapping.emailDomain || addresses.some(email => email.split("@")[1] !== mapping.emailDomain) || d.leaderEmail.split("@")[0] !== d.organization.presidentIdentifier.toLowerCase()) throw Error("Leader emails must match the selected institution's identity mapping.");
  const result = await createOrganizationAndInvitePresident(d.organization);
  if (!result.ok) throw Error(result.error);
  const actor = await requirePlatformAdmin();
  await prisma.$transaction(async tx => {
    await tx.club.update({ where: { id: result.organization.id }, data: { description: d.description, category: d.category, marketing: { organizationInfo: d.organizationInfo } } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "platform.club.details.create", targetId: result.organization.id, clubId: result.organization.id, reason: d.organization.reason, details: { result: "success" } } });
  });
  for (const leader of d.additionalLeaders) await createClubIdentityInvitation({ clubId: result.organization.id, identifierTypeId: d.organization.identifierTypeId, identifier: leader.email.split("@")[0], invitedName: leader.name, requestedRole: "ADMIN", platformDesignation: true });
  const invitations = await prisma.clubInvitation.findMany({ where: { clubId: result.organization.id, status: "PENDING" }, select: { id: true } });
  for (const invitation of invitations) await resendAdminClubInvitation(result.organization.id, invitation.id, d.organization.reason);
  return result;
}

export async function resendAdminClubInvitation(clubId: string, invitationId: string, reason: string) {
  const actor = await requirePlatformAdmin(); uuid.parse(clubId); uuid.parse(invitationId); reasonSchema.parse(reason); invitationEmailConfig();
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${clubId} FOR UPDATE`;
    const result = await enqueueInvitationEmail(tx, invitationId, clubId, actor.id, randomUUID());
    await tx.auditLog.create({ data: { actorId: actor.id, action: "platform.club.invitation.resend", targetId: invitationId, clubId, reason, details: { result: result.queued ? "queued" : "reused" } } });
    return result;
  });
  if (result.queued) scheduleInvitationDelivery(clubId);
  return result;
}
export async function changeAdminDesignatedLeader(input: unknown) {
  const actor = await requirePlatformAdmin();
  const d = z.object({ clubId: uuid, invitationId: uuid, identifierTypeId: z.string().min(1), identifier: z.string().min(1).max(128), name: z.string().trim().min(1).max(200), reason: reasonSchema }).strict().parse(input);
  invitationEmailConfig();
  const next = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${d.clubId} FOR UPDATE`;
    const prior = await tx.clubInvitation.findFirst({ where: { id: d.invitationId, clubId: d.clubId, status: "PENDING", requestedRole: "OWNER", authoritySource: "PLATFORM_ADMIN" } });
    if (!prior) throw Error("Pending platform-designated owner invitation unavailable.");
    await tx.clubInvitation.update({ where: { id: prior.id }, data: { status: "REVOKED", revokedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "club.invite.revoke", targetId: prior.id, clubId: d.clubId, reason: d.reason } });
    const replacement = await createIdentityInvitationInTransaction(tx, { clubId: d.clubId, identifierTypeId: d.identifierTypeId, identifier: d.identifier, invitedName: d.name, invitedYear: null, requestedRole: "OWNER", platformDesignation: true }, actor);
    await tx.auditLog.create({ data: { actorId: actor.id, action: "platform.club.leader.change", targetId: d.clubId, clubId: d.clubId, reason: d.reason, details: { priorInvitationId: prior.id, invitationId: replacement.id, result: "success" } } });
    return replacement;
  });
  await resendAdminClubInvitation(d.clubId, next.id, d.reason);
  return next;
}

export async function inspectAdminStudent(userId: string, reason: string) {
  await requirePlatformAdmin(); uuid.parse(userId); reasonSchema.parse(reason);
  const profile = await inspectPlatformRecord("users", userId, reason);
  const { data, error } = await adminAuth().auth.admin.getUserById(userId);
  if (error || !data.user) throw Error("Authentication identity unavailable. Retry before changing the account.");
  const lastInvitation = await prisma.auditLog.findFirst({ where: { targetId: userId, action: { in: ["platform.student.invitation.sent", "platform.student.invitation.resend"] } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  return { profile, invitation: { status: data.user.invited_at ? data.user.email_confirmed_at ? "CLAIMED" : "INVITED" : data.user.email_confirmed_at ? "REGISTERED" : "UNCONFIRMED", invitedAt: data.user.invited_at || null, claimedAt: data.user.invited_at ? data.user.email_confirmed_at || null : null, lastSentAt: lastInvitation?.createdAt || null } };
}
