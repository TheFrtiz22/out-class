/**
 * Server-only persistence for OutClass short links.
 *
 * This module is intentionally NOT a "use server" file: nothing here may become a
 * browser-callable Server Action. Callers are trusted server code (the /q route,
 * authorized meeting actions, and the authenticated createShortLink action),
 * which are responsible for their own identity and permission checks. Every
 * function takes the Prisma client or transaction explicitly.
 */

import type { Prisma } from "@prisma/client";
import type { AppTransactionClient } from "@/utils/prisma";
import {
  generateRandomShortCode,
  getTargetHash,
  isValidRedirectTarget,
  type ResolveResult,
  type ShortLinkRecord,
} from "@/lib/short-links";

type ShortLinkClient = Pick<AppTransactionClient, "platformContent">;

const SHORT_LINK_PREFIX = "shortlink:";
const TARGET_INDEX_PREFIX = "shortlink_target:";
const CLOSED_CHECK_IN_TARGET = "/meetings";

function codeKey(code: string) {
  return `${SHORT_LINK_PREFIX}${code}`;
}

function asRecord(value: unknown): ShortLinkRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ShortLinkRecord)
    : null;
}

async function unusedCode(client: ShortLinkClient) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateRandomShortCode(6);
    if (!(await client.platformContent.findUnique({ where: { key: codeKey(candidate) }, select: { id: true } })))
      return candidate;
  }
  return generateRandomShortCode(8);
}

/**
 * Returns the existing permanent short link for a vetted internal target, or
 * creates one. Callers must validate and authorize the target first.
 */
export async function findOrCreateReusableShortLink(
  client: ShortLinkClient,
  target: string,
  type: ShortLinkRecord["type"],
): Promise<{ code: string; shortUrl: string }> {
  if (!isValidRedirectTarget(target)) throw new Error("Invalid short-link destination.");
  const indexKey = `${TARGET_INDEX_PREFIX}${getTargetHash(target)}`;
  const index = asRecord((await client.platformContent.findUnique({ where: { key: indexKey } }))?.value) as { code?: unknown } | null;
  if (typeof index?.code === "string") {
    const existing = asRecord((await client.platformContent.findUnique({ where: { key: codeKey(index.code) } }))?.value);
    if (existing && !existing.revoked && existing.target === target) return { code: index.code, shortUrl: `/q/${index.code}` };
  }
  const code = await unusedCode(client);
  const record: ShortLinkRecord = {
    code,
    target,
    type,
    createdAt: new Date().toISOString(),
    expiresAt: null,
    revoked: false,
    revokedAt: null,
    revocationReason: null,
    clubId: null,
    eventId: null,
    metadata: {},
  };
  await client.platformContent.create({ data: { key: codeKey(code), value: record as unknown as Prisma.InputJsonValue } });
  await client.platformContent.upsert({
    where: { key: indexKey },
    update: { value: { code } },
    create: { key: indexKey, value: { code } },
  });
  return { code, shortUrl: `/q/${code}` };
}

/** Creates the compact link for one rotating meeting check-in token. */
export async function createMeetingCheckInShortLink(
  client: ShortLinkClient,
  input: { clubId: string; meetingId: string; token: string; createdAt: Date; expiresAt: Date },
): Promise<{ code: string; shortUrl: string }> {
  const code = await unusedCode(client);
  const record: ShortLinkRecord = {
    code,
    target: `/check-in?meetingId=${input.meetingId}#token=${input.token}`,
    type: "meeting-check-in",
    createdAt: input.createdAt.toISOString(),
    expiresAt: input.expiresAt.toISOString(),
    revoked: false,
    revokedAt: null,
    revocationReason: null,
    clubId: input.clubId,
    eventId: input.meetingId,
  };
  await client.platformContent.create({ data: { key: codeKey(code), value: record as unknown as Prisma.InputJsonValue } });
  return { code, shortUrl: `/q/${code}` };
}

function meetingLinksWhere(meetingId: string): Prisma.PlatformContentWhereInput {
  return {
    key: { startsWith: SHORT_LINK_PREFIX },
    AND: [
      { value: { path: ["type"], equals: "meeting-check-in" } },
      { value: { path: ["eventId"], equals: meetingId } },
    ],
  };
}

/**
 * Removes check-in links whose tokens can no longer be valid. Each link is
 * written once, so `updatedAt` is its creation time.
 */
export async function deleteStaleMeetingCheckInShortLinks(
  client: ShortLinkClient,
  meetingId: string,
  olderThan: Date,
) {
  await client.platformContent.deleteMany({
    where: { ...meetingLinksWhere(meetingId), updatedAt: { lt: olderThan } },
  });
}

/**
 * Closes every check-in link for a meeting: the raw token is removed from the
 * stored target and the link resolves to the branded "Check-In Closed" screen.
 */
export async function closeMeetingCheckInShortLinks(
  client: ShortLinkClient,
  meetingId: string,
  reason = "This check-in session has been closed by the host.",
) {
  const rows = await client.platformContent.findMany({ where: meetingLinksWhere(meetingId) });
  const revokedAt = new Date().toISOString();
  for (const row of rows) {
    const record = asRecord(row.value);
    if (!record || record.revoked) continue;
    const closed: ShortLinkRecord = {
      ...record,
      target: CLOSED_CHECK_IN_TARGET,
      revoked: true,
      revokedAt,
      revocationReason: reason,
    };
    await client.platformContent.update({ where: { key: row.key }, data: { value: closed as unknown as Prisma.InputJsonValue } });
  }
}

/** Resolves a short link for the /q route, checking revocation, expiry and target safety. */
export async function resolveShortLink(client: ShortLinkClient, code: string): Promise<ResolveResult> {
  if (!code || typeof code !== "string" || !/^[a-zA-Z0-9_-]{1,32}$/.test(code)) {
    return {
      status: "not-found",
      message: "The requested short link code is invalid or improperly formatted.",
    };
  }

  const record = asRecord((await client.platformContent.findUnique({ where: { key: codeKey(code) } }))?.value);
  if (!record) {
    return {
      status: "not-found",
      message: "This OutClass short link does not exist or has been removed.",
    };
  }

  if (record.revoked) {
    return {
      status: "revoked",
      record,
      message: record.revocationReason || "This link has been revoked or closed by the organizer.",
    };
  }

  if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) {
    return {
      status: "expired",
      record,
      message: "This check-in code has expired. Please scan the current QR code displayed at the meeting.",
    };
  }

  if (!isValidRedirectTarget(record.target)) {
    return {
      status: "invalid-target",
      record,
      message: "The destination URL for this link is invalid or blocked.",
    };
  }

  return { status: "valid", record, target: record.target };
}
