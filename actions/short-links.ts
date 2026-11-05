"use server";

import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { findOrCreateReusableShortLink } from "@/lib/short-link-store";
import { shareableShortLinkType } from "@/lib/short-links";

/**
 * Browser-callable: returns a compact, permanent /q link for a shareable
 * OutClass page (currently voting-session join and live-room links shown by
 * QrCodeCard). Every export of this file is a public Server Action endpoint, so
 * it requires a verified session and accepts only vetted internal paths. The
 * destination page still enforces its own authorization when opened.
 *
 * Rotating meeting check-in links are created server-side by
 * actions/meetings.ts; resolution and revocation live in lib/short-link-store.ts
 * and are deliberately not exposed here.
 */
export async function createShortLink(input: {
  target: string;
}): Promise<{ code: string; shortUrl: string }> {
  await requireAuth();
  const target = typeof input?.target === "string" ? input.target : "";
  const type = shareableShortLinkType(target);
  if (!type) throw new Error("This destination cannot be shortened.");
  return findOrCreateReusableShortLink(prisma, target, type);
}
