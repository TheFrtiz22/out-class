"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import type { RosterRowStatus } from "@prisma/client";
import { prisma, type AppTransactionClient } from "@/utils/prisma";
import { requireClubPermission } from "@/utils/auth";
import { hasPermission } from "@/lib/permissions";
import { onboardingIdentifierPattern } from "@/lib/platform-organization-onboarding";
import { parseRosterCsv, validateRosterRows, rosterSummary, ROSTER_MAX_BYTES, type RosterInputRow, type RosterRow } from "@/lib/roster-csv";

async function authorize(tx: AppTransactionClient, clubId: string, userId: string) {
  await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId} FOR UPDATE`;
  const member = await tx.clubMember.findUnique({ where: { userId_clubId: { userId, clubId } } });
  const actor = await tx.user.findUnique({ where: { id: userId }, select: { disabledAt: true } });
  if (!actor || actor.disabledAt || !hasPermission(member, "members.manage")) throw new Error("Roster upload requires member-management access.");
  const club = await tx.club.findUniqueOrThrow({ where: { id: clubId } });
  const configs = await tx.schoolIdentifierType.findMany({ where: { schoolId: club.schoolId, verification: "EMAIL_LOCAL_PART", emailDomain: { not: null }, school: { active: true } }, include: { school: true } });
  if (configs.length !== 1) throw new Error("This school needs an unambiguous university identifier/email configuration before CSV imports.");
  const config = configs[0];
  return { ...config, validationRegex: onboardingIdentifierPattern(config) };
}

async function classify(tx: AppTransactionClient, clubId: string, inputs: RosterInputRow[], config: Awaited<ReturnType<typeof authorize>>) {
  const rows = validateRosterRows(inputs, config);
  const identifiers = rows.filter(row => row.status === "READY").map(row => row.normalizedIdentifier!);
  const emails = identifiers.map(identifier => `${identifier}@${config.emailDomain}`);
  const [identities, users, members, invitations] = await Promise.all([
    tx.schoolIdentity.findMany({ where: { schoolId: config.schoolId, identifierTypeId: config.id, normalizedIdentifier: { in: identifiers } } }),
    tx.user.findMany({ where: { email: { in: emails, mode: "insensitive" } }, select: { id: true, email: true, disabledAt: true } }),
    tx.clubMember.findMany({ where: { clubId, status: "ACTIVE" }, select: { userId: true } }),
    tx.clubInvitation.findMany({ where: { clubId, status: "PENDING", expiresAt: { gt: new Date() }, OR: [{ schoolIdentity: { identifierTypeId: config.id, normalizedIdentifier: { in: identifiers } } }, { schoolIdentityId: null, email: { in: emails, mode: "insensitive" } }] } }),
  ]);
  return rows.map(row => {
    const identity = identities.find(identity => identity.normalizedIdentifier === row.normalizedIdentifier);
    const matches = users.filter(user => user.email.toLowerCase() === `${row.normalizedIdentifier}@${config.emailDomain}`.toLowerCase());
    const user = matches[0];
    const matchedUserId = identity?.userId ?? user?.id ?? null;
    const invitation = invitations.find(invite => identity && invite.schoolIdentityId === identity.id || !invite.schoolIdentityId && invite.email.toLowerCase() === `${row.normalizedIdentifier}@${config.emailDomain}`.toLowerCase());
    if (row.status === "READY") {
      if (matches.length > 1 || identity?.userId && user && identity.userId !== user.id || user?.disabledAt) { row.status = "INVALID"; row.errors.push("Account identity requires manual review"); }
      else if (members.some(member => member.userId === matchedUserId)) row.status = "ALREADY_MEMBER";
      else if (invitation) row.status = "ALREADY_INVITED";
    }
    return { ...row, existingUser: !!matchedUserId, matchedUserId, schoolIdentityId: invitation ? invitation.schoolIdentityId : identity?.id ?? null, invitationId: invitation?.id ?? null };
  });
}
const databaseStatus = (row: RosterRow): RosterRowStatus => ({ READY: "VALID", INVALID: "INVALID", DUPLICATE: "DUPLICATE_ROW", ALREADY_MEMBER: "ALREADY_MEMBER", ALREADY_INVITED: "INVITATION_REUSED" } as const)[row.status];
const publicRows = (rows: RosterRow[]) => rows.map(({ rowNumber, name, year, identifier, status, errors, warnings, existingUser }) => ({ rowNumber, name, year, identifier, status, errors, warnings, existingUser }));
const inputSchema = z.object({ clubId: z.string().uuid(), requestId: z.string().uuid(), filename: z.string().trim().min(1).max(255).regex(/\.csv$/i, "Choose a CSV file."), csv: z.string().max(ROSTER_MAX_BYTES) }).strict();

/** Preview persists input/audit only. No invitation, identity, User or membership is created. */
export async function previewRosterImport(input: unknown) {
  const data = inputSchema.parse(input);
  const { user } = await requireClubPermission(data.clubId, ["members.manage"]);
  const inputs = parseRosterCsv(data.csv);
  const fileHash = createHash("sha256").update(data.csv).digest("hex");
  return prisma.$transaction(async tx => {
    const config = await authorize(tx, data.clubId, user.id);
    const existing = await tx.rosterImport.findUnique({ where: { clubId_idempotencyKey: { clubId: data.clubId, idempotencyKey: data.requestId } }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
    if (existing && (existing.fileHash !== fileHash || existing.filename !== data.filename || existing.uploadedById !== user.id || existing.status !== "VALIDATED")) throw new Error("Upload key already used. Reupload with a new request.");
    const rows = await classify(tx, data.clubId, inputs, config);
    if (existing) {
      for (let i = 0; i < rows.length; i++) {
        const saved = existing.rows[i];
        if (saved.status !== "VALID" && rows[i].status === "READY") {
          rows[i].status = saved.status === "DUPLICATE_ROW" ? "DUPLICATE" : saved.status === "ALREADY_MEMBER" ? "ALREADY_MEMBER" : saved.status === "INVITATION_REUSED" ? "ALREADY_INVITED" : "INVALID";
          rows[i].errors.push("Excluded from original preview; reupload to include this row");
        }
      }
    }
    const summary = rosterSummary(rows);
    if (existing) {
      let changed = false;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i], saved = existing.rows[i];
        if (databaseStatus(row) !== saved.status) {
          await tx.rosterImportRow.update({ where: { id: saved.id }, data: { status: databaseStatus(row), errors: [...row.errors, ...row.warnings],
            matchedUserId: row.matchedUserId, schoolIdentityId: row.schoolIdentityId, invitationId: row.invitationId } });
          changed = true;
        }
      }
      if (changed) {
        await tx.rosterImport.update({ where: { id: existing.id }, data: { failedRows: summary.invalid } });
        await tx.auditLog.create({ data: { actorId: user.id, action: "club.roster.repreview", targetId: existing.id, clubId: data.clubId, details: summary } });
      }
    }
    const record = existing ?? await tx.rosterImport.create({ data: {
      clubId: data.clubId, uploadedById: user.id, filename: data.filename, fileHash, idempotencyKey: data.requestId,
      status: "VALIDATED", rowCount: rows.length, failedRows: summary.invalid,
      rows: { create: rows.map(row => ({ clubId: data.clubId, rowNumber: row.rowNumber, input: row.input,
        invitedName: row.name || null, invitedYear: row.year || null, identifier: row.identifier || null, normalizedIdentifier: row.normalizedIdentifier,
        matchedUserId: row.matchedUserId, schoolIdentityId: row.schoolIdentityId, invitationId: row.invitationId,
        status: databaseStatus(row), errors: [...row.errors, ...row.warnings] })) },
    } });
    if (!existing) await tx.auditLog.create({ data: { actorId: user.id, action: "club.roster.preview", targetId: record.id, clubId: data.clubId, details: summary } });
    return { id: record.id, filename: data.filename, rows: publicRows(rows), summary };
  }, { timeout: 60000 });
}

/** Explicit confirmation creates MEMBER invitations only; never sends email. */
export async function confirmRosterImport(importId: string) {
  z.string().uuid().parse(importId);
  const hint = await prisma.rosterImport.findUniqueOrThrow({ where: { id: importId } });
  const { user } = await requireClubPermission(hint.clubId, ["members.manage"]);
  return prisma.$transaction(async tx => {
    const config = await authorize(tx, hint.clubId, user.id);
    const record = await tx.rosterImport.findUniqueOrThrow({ where: { id: importId }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
    if (record.uploadedById !== user.id) throw new Error("Only the uploader can confirm this preview.");
    if (record.status === "COMPLETED") return { created: record.successfulRows, skipped: record.rowCount - record.successfulRows, reused: true };
    if (record.status !== "VALIDATED") throw new Error("Import is not ready to confirm.");
    const inputs = record.rows.map(row => z.object({ name: z.string(), year: z.string(), computing_id: z.string() }).parse(row.input));
    const rows = await classify(tx, record.clubId, inputs, config);
    let created = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i], saved = record.rows[i];
      // Never include a row that was excluded from the uploaded preview.
      if (saved.status !== "VALID") continue;
      if (row.status !== "READY") {
        await tx.rosterImportRow.update({ where: { id: saved.id }, data: { status: databaseStatus(row), errors: [...row.errors, ...row.warnings],
          matchedUserId: row.matchedUserId, schoolIdentityId: row.schoolIdentityId, invitationId: row.invitationId } });
        continue;
      }
      const identity = await tx.schoolIdentity.upsert({ where: { schoolId_identifierTypeId_normalizedIdentifier: { schoolId: config.schoolId, identifierTypeId: config.id, normalizedIdentifier: row.normalizedIdentifier! } },
        create: { schoolId: config.schoolId, identifierTypeId: config.id, identifier: row.identifier, normalizedIdentifier: row.normalizedIdentifier! }, update: {} });
      const stale = await tx.clubInvitation.findMany({ where: { clubId: record.clubId, schoolIdentityId: identity.id, status: "PENDING", expiresAt: { lte: new Date() } } });
      for (const invitation of stale) {
        await tx.clubInvitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED", expiredAt: new Date() } });
        await tx.auditLog.create({ data: { actorId: user.id, action: "club.invite.expire", targetId: invitation.id, clubId: record.clubId } });
      }
      const invitation = await tx.clubInvitation.create({ data: { clubId: record.clubId, schoolId: config.schoolId, schoolIdentityId: identity.id,
        invitedName: row.name, invitedYear: row.year || null, requestedRole: "MEMBER", purpose: "MEMBERSHIP", authoritySource: "CLUB_MEMBER",
        email: `${row.normalizedIdentifier}@${config.emailDomain}`, invitedBy: user.id, permissions: [], expiresAt: new Date(Date.now() + 7 * 86400000) } });
      await tx.rosterImportRow.update({ where: { id: saved.id }, data: { status: "INVITATION_CREATED", schoolIdentityId: identity.id, invitationId: invitation.id, matchedUserId: row.matchedUserId } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "club.identity-invite.create", targetId: invitation.id, clubId: record.clubId, details: { importId, rowNumber: row.rowNumber } } });
      created++;
    }
    await tx.rosterImport.update({ where: { id: importId }, data: { status: "COMPLETED", successfulRows: created, failedRows: rows.filter((row, i) => row.status === "INVALID" || record.rows[i].status === "INVALID").length, completedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "club.roster.confirm", targetId: importId, clubId: record.clubId, details: { created, skipped: rows.length - created } } });
    return { created, skipped: rows.length - created, reused: false };
  }, { timeout: 60000 });
}
