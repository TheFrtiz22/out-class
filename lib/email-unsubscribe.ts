import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { emailPreferencesPath, emailSiteOrigin } from "@/lib/transactional-email";

/**
 * One-click unsubscribe (RFC 8058) for optional email: digests and Club announcements.
 *
 * Token: `v1.<keyId>.<base64url(userId.scope)>.<HMAC>`. The HMAC key is EMAIL_UNSUBSCRIBE_SECRET;
 * keyId is derived from it (first 8 hex of its SHA-256), so rotating the secret invalidates every
 * old token cleanly. During a grace period the previous secret can be kept in
 * EMAIL_UNSUBSCRIBE_SECRET_PREVIOUS; tokens are only ever signed with the current one.
 *
 * A token grants exactly one thing: turning optional email off for that user (unsubscribeChanges).
 * It never signs anyone in, never reads or reveals account data, never turns email on, and never
 * touches application, decision or interview email.
 */
export const unsubscribeScopes = ["digest", "announcements"] as const;
export type UnsubscribeScope = typeof unsubscribeScopes[number];
export const UNSUBSCRIBE_PATH = "/api/email/unsubscribe";
const VERSION = "v1", CONTEXT = "outclass-email-unsubscribe/v1";

type Key = { id: string; secret: string };
const toKey = (value: string | undefined): Key | null => value && value.length >= 32 ? { id: createHash("sha256").update(value).digest("hex").slice(0, 8), secret: value } : null;
const currentKey = () => toKey(process.env.EMAIL_UNSUBSCRIBE_SECRET);
const verificationKeys = () => [currentKey(), toKey(process.env.EMAIL_UNSUBSCRIBE_SECRET_PREVIOUS)].filter((k): k is Key => !!k);
const mac = (key: Key, userId: string, scope: UnsubscribeScope) => createHmac("sha256", key.secret).update(`${CONTEXT}\n${key.id}\n${userId}\n${scope}`).digest();

export function signUnsubscribeToken(userId: string, scope: UnsubscribeScope): string | null {
  const key = currentKey();
  if (!key) return null;
  const id = z.string().uuid().parse(userId);
  return `${VERSION}.${key.id}.${Buffer.from(`${id}.${scope}`).toString("base64url")}.${mac(key, id, scope).toString("base64url")}`;
}

export function verifyUnsubscribeToken(token: unknown): { userId: string; scope: UnsubscribeScope } | null {
  if (typeof token !== "string" || token.length > 300) return null;
  const [version, keyId, body, signature, extra] = token.split(".");
  if (version !== VERSION || !keyId || !body || !signature || extra !== undefined) return null;
  const key = verificationKeys().find(k => k.id === keyId);
  if (!key) return null;
  const [userId, scope, more] = Buffer.from(body, "base64url").toString("utf8").split(".");
  if (more !== undefined || !z.string().uuid().safeParse(userId).success || !(unsubscribeScopes as readonly string[]).includes(scope)) return null;
  const expected = mac(key, userId, scope as UnsubscribeScope), given = Buffer.from(signature, "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected) ? { userId, scope: scope as UnsubscribeScope } : null;
}

type Preferences = { emailFrequency: string };
/**
 * What an unsubscribe changes. Never emailApplications or emailInterviews (decisions, offers,
 * interviews), never emailMessages or emailInvitations, and never emailFrequency "OFF", which
 * would block every category (communications-policy optionalEmailAllowed).
 * - digest: stop the daily digest (DAILY becomes INSTANT, so application, decision and interview
 *   email arrives as it happens) and turn off the optional categories: announcements, tasks and
 *   OutClass platform news. A user already on OFF stays OFF.
 * - announcements: turn off Club announcement email only.
 */
export function unsubscribeChanges(scope: UnsubscribeScope, current: Preferences | null) {
  if (scope === "announcements") return { emailAnnouncements: false };
  return { emailAnnouncements: false, emailTasks: false, emailPlatform: false, ...(current?.emailFrequency === "DAILY" ? { emailFrequency: "INSTANT" } : {}) };
}
export const unsubscribeOutcome = {
  digest: { stops: "your daily digest and optional emails: Club announcements, task reminders and OutClass news", continues: "Emails about your applications, decisions and interviews, messages from Clubs, and sign-in codes will continue, sent as they happen." },
  announcements: { stops: "Club announcement emails", continues: "Emails about your applications, decisions and interviews, messages from Clubs, and sign-in codes will continue." },
} as const;

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
