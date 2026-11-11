import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { emailPreferencesPath, emailSiteOrigin } from "@/lib/transactional-email";

/**
 * One-click unsubscribe (RFC 8058) for optional email: digests and Club announcements.
 *
 * The token is an HMAC over (user id, scope) with EMAIL_UNSUBSCRIBE_SECRET. It grants exactly one
 * thing: turning OFF one optional email category for that user. It never signs anyone in, never
 * reads or reveals account data, and cannot turn email back on. A leaked token can at worst stop
 * that user's optional email, which the user can re-enable in their preferences.
 */
export const unsubscribeScopes = ["digest", "announcements"] as const;
export type UnsubscribeScope = typeof unsubscribeScopes[number];
export const UNSUBSCRIBE_PATH = "/api/email/unsubscribe";
const CONTEXT = "outclass-email-unsubscribe/v1";

function secret() {
  const value = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  return value && value.length >= 32 ? value : null;
}
const mac = (key: string, userId: string, scope: UnsubscribeScope) => createHmac("sha256", key).update(`${CONTEXT}\n${userId}\n${scope}`).digest();

export function signUnsubscribeToken(userId: string, scope: UnsubscribeScope): string | null {
  const key = secret();
  if (!key) return null;
  const id = z.string().uuid().parse(userId);
  return `${Buffer.from(`${id}.${scope}`).toString("base64url")}.${mac(key, id, scope).toString("base64url")}`;
}

export function verifyUnsubscribeToken(token: unknown): { userId: string; scope: UnsubscribeScope } | null {
  const key = secret();
  if (!key || typeof token !== "string" || token.length > 300) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  const [userId, scope, more] = Buffer.from(body, "base64url").toString("utf8").split(".");
  if (more !== undefined || !z.string().uuid().safeParse(userId).success || !(unsubscribeScopes as readonly string[]).includes(scope)) return null;
  const expected = mac(key, userId, scope as UnsubscribeScope), given = Buffer.from(signature, "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected) ? { userId, scope: scope as UnsubscribeScope } : null;
}

let missingSecretWarned = false;
/**
 * List-Unsubscribe headers for one optional email. With a secret: one-click POST URL plus the
 * preferences page. Without one: the preferences page only (no List-Unsubscribe-Post), one warning.
 */
export function listUnsubscribeHeaders(siteUrl: string, userId: string, scope: UnsubscribeScope) {
  const origin = emailSiteOrigin(siteUrl), preferences = `<${origin}${emailPreferencesPath}>`;
  const token = signUnsubscribeToken(userId, scope);
  if (!token) {
    if (!missingSecretWarned) { missingSecretWarned = true; console.warn("EMAIL_UNSUBSCRIBE_SECRET is not set; List-Unsubscribe points to email preferences without one-click."); }
    return { "List-Unsubscribe": preferences };
  }
  const oneClick = new URL(UNSUBSCRIBE_PATH, origin);
  oneClick.searchParams.set("token", token);
  return { "List-Unsubscribe": `<${oneClick.href}>, ${preferences}`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" as const };
}
