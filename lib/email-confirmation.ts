import { createHash } from "node:crypto";
import { setPasswordAfterConfirmation } from "@/lib/signup-password";

// Server-only helpers for /api/auth/confirm-email.

/** One response for a wrong, expired or rate-limited code, so none can be told apart. */
export const EMAIL_CODE_REJECTED = "That code isn't valid or has expired. Check it or send yourself a new one.";

/** Accounts confirmed before the confirmation route shipped keep their password and sessions. */
export const PASSWORD_REVIEW_START = "2026-11-10T00:00:00.000Z";

export const PASSWORD_SECURED_KEY = "outclass_password_secured";

type ConfirmedUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  invited_at?: string | null;
  app_metadata?: Record<string, unknown> | null;
};

function sameEmail(record: unknown, user: ConfirmedUser) {
  if (!record || typeof record !== "object") return false;
  const value = record as { email?: unknown; userId?: unknown };
  return typeof value.email === "string" && value.email === user.email?.trim().toLowerCase() &&
    (value.userId === undefined || value.userId === user.id);
}

/**
 * True when the account's password needs no change at this verification. The record lives in
 * app_metadata, which only the service role can write; password recovery writes its own record, and
 * invited accounts get their first password from the invitation claim after verification.
 */
export function passwordAlreadySecured(user: ConfirmedUser) {
  const metadata = user.app_metadata ?? {};
  if (sameEmail(metadata[PASSWORD_SECURED_KEY], user)) return true;
  if (sameEmail(metadata.outclass_verified_email, user)) return true;
  if (user.invited_at) return true;
  const confirmedAt = Date.parse(user.email_confirmed_at || "");
  return Number.isFinite(confirmedAt) && confirmedAt < Date.parse(PASSWORD_REVIEW_START);
}

function unusablePassword() {
  // Never returned or stored anywhere: the account signs in with an email code until a password is chosen.
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return `${Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("").slice(0, 60)}aA1!`;
}

type SessionClient = {
  auth: {
    updateUser(input: { password: string }): Promise<{ error: { code?: string; status?: number } | null }>;
    signOut(input: { scope: "others" }): Promise<{ error: unknown }>;
  };
};
type AdminClient = {
  auth: { admin: {
    updateUserById(id: string, input: { password?: string; app_metadata?: Record<string, unknown> }): Promise<{ error: unknown }>;
  } };
};

async function succeeded(call: () => Promise<{ error: unknown }>) {
  try { return !(await call()).error; } catch { return false; }
}

/**
 * Keeps only the password supplied with the code (or an unusable one), signs out every other session,
 * and records the result. Each step is safe to repeat, so a later verification finishes an incomplete one.
 */
export async function secureVerifiedAccount(client: SessionClient, admin: AdminClient | null, user: ConfirmedUser, password: string | undefined) {
  const saved = (await setPasswordAfterConfirmation(client, password)).saved;
  const replaced = saved ||
    (await setPasswordAfterConfirmation(client, unusablePassword())).saved ||
    (!!admin && await succeeded(() => admin.auth.admin.updateUserById(user.id, { password: unusablePassword() })));
  const othersSignedOut = replaced && await succeeded(() => client.auth.signOut({ scope: "others" }));
  const recorded = othersSignedOut && !!admin && await succeeded(() => admin.auth.admin.updateUserById(user.id, {
    app_metadata: { [PASSWORD_SECURED_KEY]: { userId: user.id, email: user.email?.trim().toLowerCase(), securedAt: new Date().toISOString() } },
  }));
  return { passwordSaved: saved, secured: replaced && othersSignedOut, recorded };
}

// Code attempts per address and per client network, counted from append-only audit rows.
export const EMAIL_CODE_WINDOW_MS = 15 * 60 * 1000;
export const EMAIL_CODE_LIMIT_PER_EMAIL = 8;
export const EMAIL_CODE_LIMIT_PER_IP = 40;
const ATTEMPT_ACTION = "auth.email_code.attempt";

export function attemptKey(kind: "email" | "ip", value: string) {
  return `${kind}:${createHash("sha256").update(`outclass-email-code-v1\0${kind}\0`).update(value.trim().toLowerCase()).digest("hex")}`;
}

type AttemptStore = {
  auditLog: {
    count(input: { where: { targetId: string; action: string; createdAt: { gt: Date } } }): Promise<number>;
    create(input: { data: { actorId: string; action: string; targetId: string } }): Promise<unknown>;
  };
};

/** Records this attempt and reports whether the address and the network are both under their limits. */
export async function recordEmailCodeAttempt(db: AttemptStore, email: string, ip: string | undefined, now = Date.now()) {
  const since = new Date(now - EMAIL_CODE_WINDOW_MS);
  const keys: Array<[string, number]> = [[attemptKey("email", email), EMAIL_CODE_LIMIT_PER_EMAIL]];
  if (ip) keys.push([attemptKey("ip", ip), EMAIL_CODE_LIMIT_PER_IP]);
  const counts = await Promise.all(keys.map(([targetId]) => db.auditLog.count({ where: { targetId, action: ATTEMPT_ACTION, createdAt: { gt: since } } })));
  const allowed = counts.every((count, index) => count < keys[index][1]);
  await Promise.all(keys.map(([targetId]) => db.auditLog.create({ data: { actorId: "anonymous", action: ATTEMPT_ACTION, targetId } })));
  return allowed;
}
