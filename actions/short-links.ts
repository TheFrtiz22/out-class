"use server";

import { prisma } from "@/utils/prisma";
import {
  generateRandomShortCode,
  isValidRedirectTarget,
  getTargetHash,
  type ShortLinkRecord,
  type ResolveResult,
} from "@/lib/short-links";

export interface CreateShortLinkInput {
  target: string;
  type?: ShortLinkRecord["type"];
  expiresAt?: Date | string | null;
  reusable?: boolean;
  clubId?: string | null;
  eventId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Creates or retrieves a compact short link stored securely in PlatformContent.
 * For reusable targets (e.g., permanent club flyers), returns existing short links.
 */
export async function createShortLink(
  input: CreateShortLinkInput,
): Promise<{ code: string; shortUrl: string; record: ShortLinkRecord }> {
  const target = input.target.trim();
  if (!isValidRedirectTarget(target)) {
    throw new Error(
      "Invalid destination. OutClass short links only accept internal routes or approved domains.",
    );
  }

  const isReusable = input.reusable && !input.expiresAt;
  const targetHash = getTargetHash(target);

  // Check reusable mapping cache in PlatformContent
  if (isReusable) {
    const existingIndex = await prisma.platformContent.findUnique({
      where: { key: `shortlink_target:${targetHash}` },
    });
    if (existingIndex && typeof existingIndex.value === "object" && existingIndex.value !== null) {
      const code = (existingIndex.value as { code?: string }).code;
      if (code) {
        const existingRecord = await prisma.platformContent.findUnique({
          where: { key: `shortlink:${code}` },
        });
        if (existingRecord && typeof existingRecord.value === "object") {
          const rec = existingRecord.value as unknown as ShortLinkRecord;
          if (!rec.revoked) {
            return {
              code,
              shortUrl: `/q/${code}`,
              record: rec,
            };
          }
        }
      }
    }
  }

  // Generate unique collision-resistant short identifier with retry backoff
  let code = "";
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    attempts++;
    const candidate = generateRandomShortCode(6);
    const existing = await prisma.platformContent.findUnique({
      where: { key: `shortlink:${candidate}` },
    });
    if (!existing) {
      code = candidate;
      break;
    }
  }

  if (!code) {
    // Fallback to 8 chars if 6 had collision
    code = generateRandomShortCode(8);
  }

  const expiresIso = input.expiresAt
    ? (input.expiresAt instanceof Date
        ? input.expiresAt.toISOString()
        : new Date(input.expiresAt).toISOString())
    : null;

  const record: ShortLinkRecord = {
    code,
    target,
    type: input.type || "generic",
    createdAt: new Date().toISOString(),
    expiresAt: expiresIso,
    revoked: false,
    revokedAt: null,
    revocationReason: null,
    clubId: input.clubId || null,
    eventId: input.eventId || null,
    metadata: input.metadata || {},
  };

  // Atomic database writes
  await prisma.platformContent.create({
    data: {
      key: `shortlink:${code}`,
      value: record as unknown as object,
    },
  });

  if (isReusable) {
    await prisma.platformContent.upsert({
      where: { key: `shortlink_target:${targetHash}` },
      update: { value: { code } },
      create: {
        key: `shortlink_target:${targetHash}`,
        value: { code },
      },
    });
  }

  return {
    code,
    shortUrl: `/q/${code}`,
    record,
  };
}

/**
 * Resolves a short link and verifies validity, expiration, and revocation.
 */
export async function resolveShortLink(code: string): Promise<ResolveResult> {
  if (!code || typeof code !== "string" || !/^[a-zA-Z0-9_-]{1,32}$/.test(code)) {
    return {
      status: "not-found",
      message: "The requested short link code is invalid or improperly formatted.",
    };
  }

  const entry = await prisma.platformContent.findUnique({
    where: { key: `shortlink:${code}` },
  });

  if (!entry || typeof entry.value !== "object" || entry.value === null) {
    return {
      status: "not-found",
      message: "This OutClass short link does not exist or has been removed.",
    };
  }

  const record = entry.value as unknown as ShortLinkRecord;

  // Check explicit revocation
  if (record.revoked) {
    return {
      status: "revoked",
      record,
      message:
        record.revocationReason ||
        "This link has been revoked or closed by the organizer.",
    };
  }

  // Check expiration
  if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) {
    return {
      status: "expired",
      record,
      message:
        "This check-in code has expired. Please scan the current QR code displayed at the meeting.",
    };
  }

  // Check destination safety
  if (!isValidRedirectTarget(record.target)) {
    return {
      status: "invalid-target",
      record,
      message: "The destination URL for this link is invalid or blocked.",
    };
  }

  return {
    status: "valid",
    record,
    target: record.target,
  };
}

/**
 * Revokes a short link by identifier.
 */
export async function revokeShortLink(
  code: string,
  reason: string = "Revoked by host.",
): Promise<{ success: boolean }> {
  const entry = await prisma.platformContent.findUnique({
    where: { key: `shortlink:${code}` },
  });
  if (!entry || typeof entry.value !== "object" || entry.value === null) {
    return { success: false };
  }

  const record = entry.value as unknown as ShortLinkRecord;
  record.revoked = true;
  record.revokedAt = new Date().toISOString();
  record.revocationReason = reason;

  await prisma.platformContent.update({
    where: { key: `shortlink:${code}` },
    data: { value: record as unknown as object },
  });

  return { success: true };
}
