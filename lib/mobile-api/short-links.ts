import { resolveShortLink } from "@/lib/short-link-store";
import { requireAuth } from "@/utils/auth";
import { prisma } from "@/utils/prisma";

/**
 * What the `/q/<code>` page does, for the app's scanner: resolve a first-party short link to its
 * site path. The page answers anyone and redirects; the app must be signed in to ask, and gets the
 * path back so a check-in can complete inside the app with the signed-in session (the check-in
 * itself is still authorized by `checkInMeeting`). Unknown and expired codes share one answer, and
 * only a check-in the host closed explains itself, exactly as on the page.
 */
export async function resolveMobileShortLink(code: string) {
  await requireAuth();
  const result = await resolveShortLink(prisma, code);
  if (result.status === "valid" && result.target) return { status: "valid" as const, target: result.target };
  if (result.status === "revoked") return { status: "closed" as const, message: result.message || "The host closed this check-in, so attendance is no longer being recorded." };
  return { status: "unavailable" as const };
}
