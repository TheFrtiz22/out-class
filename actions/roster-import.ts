"use server";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { RosterImportRow, RosterRowStatus } from "@prisma/client";
import { prisma, type AppTransactionClient } from "@/utils/prisma";
import { requireClubPermission } from "@/utils/auth";
import { hasPermission } from "@/lib/permissions";
import { onboardingIdentifierPattern } from "@/lib/platform-organization-onboarding";
import { parseRosterCsv, validateRosterRows, rosterSummary, ROSTER_MAX_BYTES, ROSTER_MAX_ROWS, type RosterInputRow, type RosterRow } from "@/lib/roster-csv";

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
    tx.$queryRaw<{ id: string; email: string; disabledAt: Date | null }[]>`SELECT id, email, "disabledAt" FROM "User" WHERE lower(email) = ANY(${emails.map(email => email.toLowerCase())}::text[])`,
    tx.clubMember.findMany({ where: { clubId, status: "ACTIVE" }, select: { userId: true } }),
    tx.clubInvitation.findMany({ where: { clubId, status: "PENDING", expiresAt: { gt: new Date() }, OR: [{ schoolIdentity: { identifierTypeId: config.id, normalizedIdentifier: { in: identifiers } } }, { schoolIdentityId: null, email: { in: emails, mode: "insensitive" } }] } }),
  ]);
  const identityByIdentifier = new Map(identities.map(i => [i.normalizedIdentifier, i]));
  const usersByEmail = new Map<string, typeof users>();
  for (const user of users) { const email = user.email.toLowerCase(); usersByEmail.set(email, [...(usersByEmail.get(email) || []), user]); }
  const memberIds = new Set(members.map(m => m.userId));
  const invitationsByIdentity = new Map(invitations.filter(i => i.schoolIdentityId).map(i => [i.schoolIdentityId, i]));
  const invitationsByEmail = new Map(invitations.filter(i => !i.schoolIdentityId).map(i => [i.email.toLowerCase(), i]));
  return rows.map(row => {
    const identity = identityByIdentifier.get(row.normalizedIdentifier!);
    const email = `${row.normalizedIdentifier}@${config.emailDomain}`.toLowerCase();
    const matches = usersByEmail.get(email) || [];
    const user = matches[0];
    const matchedUserId = identity?.userId ?? user?.id ?? null;
    const invitation = (identity && invitationsByIdentity.get(identity.id)) || invitationsByEmail.get(email);
    if (row.status === "READY") {
      if (matches.length > 1 || identity?.userId && user && identity.userId !== user.id || user?.disabledAt) { row.status = "INVALID"; row.errors.push("Account identity requires manual review"); }
      else if (memberIds.has(matchedUserId!)) row.status = "ALREADY_MEMBER";
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
      rows: { create: rows.map(row => ({ rowNumber: row.rowNumber, input: row.input,
        invitedName: row.name || null, invitedYear: row.year || null, identifier: row.identifier || null, normalizedIdentifier: row.normalizedIdentifier,
        matchedUserId: row.matchedUserId, schoolIdentityId: row.schoolIdentityId, invitationId: row.invitationId,
        status: databaseStatus(row), errors: [...row.errors, ...row.warnings] })) },
    } });
    if (!existing) await tx.auditLog.create({ data: { actorId: user.id, action: "club.roster.preview", targetId: record.id, clubId: data.clubId, details: summary } });
    return { id: record.id, filename: data.filename, rows: publicRows(rows), summary };
  }, { timeout: 60000 });
}

const IMPORT_BATCH_SIZE = 50;
const importRowInput = z.object({ name: z.string(), year: z.string(), computing_id: z.string() });

function importResult(rows: RosterImportRow[], completed: boolean, reused: boolean) {
  const count = (status: RosterRowStatus) => rows.filter(row => row.status === status).length;
  const created = count("INVITATION_CREATED");
  return {
    existingUsers: rows.filter(row => row.status === "INVITATION_CREATED" && row.matchedUserId).length,
    created, alreadyMember: count("ALREADY_MEMBER"), alreadyInvited: count("INVITATION_REUSED"),
    invalid: count("INVALID"), duplicates: count("DUPLICATE_ROW"), failed: count("FAILED"),
    total: rows.length, processed: rows.length - count("VALID"), skipped: rows.length - created - count("VALID"), completed, reused,
    rows: completed ? rows.map(row => ({ rowNumber: row.rowNumber, name: row.invitedName || "", year: row.invitedYear || "",
      identifier: row.identifier || "", status: row.status === "INVITATION_REUSED" ? "ALREADY_INVITED" as const : row.status,
      errors: Array.isArray(row.errors) ? row.errors.filter((value): value is string => typeof value === "string") : [] })) : [],
  };
}

function rowDataError(error: unknown) {
  // Do not convert authorization, connectivity, timeout, or audit failures into row errors.
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  return ["P2000", "P2002", "P2003", "P2011", "P2014", "P2020", "23502", "23503", "23505", "23514", "22001", "22003", "22P02"].includes(code) ? code : null;
}

/** Normal import path has a fixed number of DB writes, independent of row count.
 * A row constraint failure rolls back this savepoint and uses the isolated fallback below. */
async function bulkReadyRows(tx: AppTransactionClient, record: { id: string; clubId: string }, entries: { saved: RosterImportRow; row: Awaited<ReturnType<typeof classify>>[number] }[], config: Awaited<ReturnType<typeof authorize>>, userId: string) {
  if (!entries.length) return new Set<string>();
  await tx.$executeRaw`SAVEPOINT roster_bulk`;
  let expired: { id: string }[] = [];
  let invitations: { id: string; rowId: string; rowNumber: number }[] = [];
  try {
    await tx.schoolIdentity.createMany({ data: entries.map(({ row }) => ({ id: randomUUID(), schoolId: config.schoolId, identifierTypeId: config.id, identifier: row.identifier, normalizedIdentifier: row.normalizedIdentifier! })), skipDuplicates: true });
    const identities = await tx.schoolIdentity.findMany({ where: { schoolId: config.schoolId, identifierTypeId: config.id, normalizedIdentifier: { in: entries.map(({ row }) => row.normalizedIdentifier!) } } });
    const identityMap = new Map(identities.map(i => [i.normalizedIdentifier, i.id]));
    expired = await tx.clubInvitation.findMany({ where: { clubId: record.clubId, schoolIdentityId: { in: identities.map(i => i.id) }, status: "PENDING", expiresAt: { lte: new Date() } }, select: { id: true } });
    if (expired.length) await tx.clubInvitation.updateMany({ where: { id: { in: expired.map(i => i.id) }, clubId: record.clubId }, data: { status: "EXPIRED", expiredAt: new Date() } });
    invitations = entries.map(({ saved }) => ({ id: randomUUID(), rowId: saved.id, rowNumber: saved.rowNumber }));
    await tx.clubInvitation.createMany({ data: entries.map(({ row }, index) => ({ id: invitations[index].id, clubId: record.clubId, schoolId: config.schoolId, schoolIdentityId: identityMap.get(row.normalizedIdentifier!)!, invitedName: row.name, invitedYear: row.year || null, requestedRole: "MEMBER", purpose: "MEMBERSHIP", authoritySource: "CLUB_MEMBER", email: `${row.normalizedIdentifier}@${config.emailDomain}`, invitedBy: userId, permissions: [], expiresAt: new Date(Date.now() + 7 * 86400000) })) });
    const payload = JSON.stringify(entries.map(({ saved, row }, index) => ({ id: saved.id, identity: identityMap.get(row.normalizedIdentifier!)!, invitation: invitations[index].id, user: row.matchedUserId })));
    await tx.$executeRaw`UPDATE "RosterImportRow" r SET status = 'INVITATION_CREATED', "schoolIdentityId" = x.identity, "invitationId" = x.invitation, "matchedUserId" = x."user"
      FROM jsonb_to_recordset(${payload}::jsonb) AS x(id text, identity text, invitation text, "user" text)
      WHERE r.id = x.id AND r."importId" = ${record.id} AND r."clubId" = ${record.clubId} AND r.status = 'VALID'`;
  } catch (error) {
    const code = rowDataError(error);
    if (!code) throw error;
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT roster_bulk`;
    await tx.$executeRaw`RELEASE SAVEPOINT roster_bulk`;
    return new Set<string>();
  }
  await tx.$executeRaw`RELEASE SAVEPOINT roster_bulk`;
  if (expired.length) await tx.auditLog.create({ data: { actorId: userId, clubId: record.clubId, targetId: record.id, action: "club.invite.expire", details: { invitationIds: expired.map(i => i.id), importId: record.id } } });
  await tx.auditLog.create({ data: { actorId: userId, clubId: record.clubId, targetId: record.id, action: "club.identity-invite.create", details: { importId: record.id, invitations } } });
  return new Set(entries.map(({ saved }) => saved.id));
}

/** One resumable transaction of at most 50 ready rows. Creates MEMBER invitations only; no email. */
export async function confirmRosterImport(importId: string) {
  z.string().uuid().parse(importId);
  const hint = await prisma.rosterImport.findUniqueOrThrow({ where: { id: importId } });
  const { user } = await requireClubPermission(hint.clubId, ["members.manage"]);
  return prisma.$transaction(async tx => {
    const config = await authorize(tx, hint.clubId, user.id);
    const record = await tx.rosterImport.findUniqueOrThrow({ where: { id: importId }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
    if (record.clubId !== hint.clubId || record.uploadedById !== user.id) throw new Error("Only the uploader can confirm this preview.");
    if (record.status === "COMPLETED") return importResult(record.rows, true, true);
    if (!["VALIDATED", "PROCESSING"].includes(record.status)) throw new Error("Import is not ready to confirm.");
    if (record.rows.length > ROSTER_MAX_ROWS || record.rows.some(row => row.clubId !== record.clubId || row.importId !== record.id || row.status === "PENDING")) throw new Error("Import rows require review.");
    if (record.status === "VALIDATED") {
      await tx.rosterImport.update({ where: { id: importId }, data: { status: "PROCESSING" } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "club.roster.start", targetId: importId, clubId: record.clubId } });
    }
    // Keep duplicate detection across the complete original input, not individual batches.
    const inputs = record.rows.map(row => importRowInput.safeParse(row.input));
    const classified = await classify(tx, record.clubId, inputs.map(parsed => parsed.success ? parsed.data : { name: "", year: "", computing_id: "" }), config);
    const selected = record.rows.filter(row => row.status === "VALID").slice(0, IMPORT_BATCH_SIZE);
    const indexById = new Map(record.rows.map((row, index) => [row.id, index]));
    const ready = selected.flatMap(saved => {
      const index = indexById.get(saved.id)!;
      const row = classified[index];
      return inputs[index].success && row.status === "READY" && saved.normalizedIdentifier === row.normalizedIdentifier ? [{ saved, row }] : [];
    });
    const completedIds = await bulkReadyRows(tx, record, ready, config, user.id);
    for (const saved of selected.filter(row => !completedIds.has(row.id))) {
      const index = indexById.get(saved.id)!;
      const row = classified[index];
      if (!inputs[index].success) { row.status = "INVALID"; row.errors = ["Malformed saved roster input; reupload this row"]; }
      if (saved.normalizedIdentifier !== row.normalizedIdentifier && row.status === "READY") {
        row.status = "INVALID"; row.errors.push("School identifier mapping changed; reupload this row");
      }
      await tx.$executeRaw`SAVEPOINT roster_import_row`;
      const expiredIds: string[] = [];
      let createdInvitationId = "";
      try {
        if (row.status !== "READY") {
          await tx.rosterImportRow.update({ where: { id: saved.id }, data: { status: databaseStatus(row), errors: [...row.errors, ...row.warnings],
            matchedUserId: row.matchedUserId, schoolIdentityId: row.schoolIdentityId, invitationId: row.invitationId } });
          await tx.$executeRaw`RELEASE SAVEPOINT roster_import_row`;
          continue;
        }
        const identity = await tx.schoolIdentity.upsert({ where: { schoolId_identifierTypeId_normalizedIdentifier: { schoolId: config.schoolId, identifierTypeId: config.id, normalizedIdentifier: row.normalizedIdentifier! } },
          create: { schoolId: config.schoolId, identifierTypeId: config.id, identifier: row.identifier, normalizedIdentifier: row.normalizedIdentifier! }, update: {} });
        const stale = await tx.clubInvitation.findMany({ where: { clubId: record.clubId, schoolIdentityId: identity.id, status: "PENDING", expiresAt: { lte: new Date() } } });
        for (const invitation of stale) {
          await tx.clubInvitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED", expiredAt: new Date() } });
          expiredIds.push(invitation.id);
        }
        const invitation = await tx.clubInvitation.create({ data: { clubId: record.clubId, schoolId: config.schoolId, schoolIdentityId: identity.id,
          invitedName: row.name, invitedYear: row.year || null, requestedRole: "MEMBER", purpose: "MEMBERSHIP", authoritySource: "CLUB_MEMBER",
          email: `${row.normalizedIdentifier}@${config.emailDomain}`, invitedBy: user.id, permissions: [], expiresAt: new Date(Date.now() + 7 * 86400000) } });
        await tx.rosterImportRow.update({ where: { id: saved.id }, data: { status: "INVITATION_CREATED", schoolIdentityId: identity.id, invitationId: invitation.id, matchedUserId: row.matchedUserId } });
        createdInvitationId = invitation.id;
      } catch (error) {
        const code = rowDataError(error);
        if (!code) throw error;
        await tx.$executeRaw`ROLLBACK TO SAVEPOINT roster_import_row`;
        await tx.$executeRaw`RELEASE SAVEPOINT roster_import_row`;
        // A concurrent legacy writer may have won a uniqueness race. Recheck before recording failure.
        const [latest] = await classify(tx, record.clubId, [row.input], config);
        if (latest.status === "ALREADY_MEMBER" || latest.status === "ALREADY_INVITED") {
          await tx.rosterImportRow.update({ where: { id: saved.id }, data: { status: databaseStatus(latest), matchedUserId: latest.matchedUserId,
            schoolIdentityId: latest.schoolIdentityId, invitationId: latest.invitationId, errors: latest.warnings } });
        } else {
          await tx.rosterImportRow.update({ where: { id: saved.id }, data: { status: "FAILED", errors: ["This row could not be imported. Review and reupload it."] } });
          await tx.auditLog.create({ data: { actorId: user.id, action: "club.roster.row-failed", targetId: saved.id, clubId: record.clubId, details: { importId, rowNumber: saved.rowNumber, code } } });
        }
        continue;
      }
      await tx.$executeRaw`RELEASE SAVEPOINT roster_import_row`;
      // Audit failures are fatal to the batch, including constraint failures.
      for (const id of expiredIds) await tx.auditLog.create({ data: { actorId: user.id, action: "club.invite.expire", targetId: id, clubId: record.clubId } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "club.identity-invite.create", targetId: createdInvitationId, clubId: record.clubId, details: { importId, rowNumber: saved.rowNumber } } });
    }
    const outcomes = await tx.rosterImportRow.findMany({ where: { importId, clubId: record.clubId }, orderBy: { rowNumber: "asc" } });
    const completed = outcomes.every(row => row.status !== "VALID");
    const result = importResult(outcomes, completed, false);
    await tx.rosterImport.update({ where: { id: importId }, data: { status: completed ? "COMPLETED" : "PROCESSING", successfulRows: result.created,
      failedRows: result.invalid + result.failed, completedAt: completed ? new Date() : null } });
    await tx.auditLog.create({ data: { actorId: user.id, action: completed ? "club.roster.confirm" : "club.roster.batch", targetId: importId, clubId: record.clubId,
      details: { created: result.created, alreadyMember: result.alreadyMember, alreadyInvited: result.alreadyInvited, invalid: result.invalid, duplicates: result.duplicates, failed: result.failed, processed: result.processed } } });
    return result;
  }, { timeout: 60000 });
}
