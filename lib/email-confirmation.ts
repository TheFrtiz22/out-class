import { createHash, createHmac } from "node:crypto";
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
 * Keeps only the password supplied with the code (or an unusable one) and signs out every other session.
 * The server sets the final password after other sessions end and signs them out again, so a change made
 * from another session in between does not remain. The record is written last. Each step is safe to
 * repeat, so a later verification finishes an incomplete one.
 */
export async function secureVerifiedAccount(client: SessionClient, admin: AdminClient, user: ConfirmedUser, password: string | undefined) {
  // The session update checks the password against Auth's rules and ends other sessions in the same step.
  const saved = (await setPasswordAfterConfirmation(client, password)).saved;
  const finalPassword = saved ? password! : unusablePassword();
  if (!saved) await setPasswordAfterConfirmation(client, finalPassword);
  await succeeded(() => client.auth.signOut({ scope: "others" }));
  const set = await succeeded(() => admin.auth.admin.updateUserById(user.id, { password: finalPassword }));
  const othersSignedOut = set && await succeeded(() => client.auth.signOut({ scope: "others" }));
  const recorded = othersSignedOut && await succeeded(() => admin.auth.admin.updateUserById(user.id, {
    app_metadata: { [PASSWORD_SECURED_KEY]: { userId: user.id, email: user.email?.trim().toLowerCase(), securedAt: new Date().toISOString() } },
  }));
  return { passwordSaved: saved, secured: set && othersSignedOut, recorded };
}

// Code attempts per address and per client network, counted from append-only audit rows.
export const EMAIL_CODE_WINDOW_MS = 15 * 60 * 1000;
export const EMAIL_CODE_LIMIT_PER_EMAIL = 8;
export const EMAIL_CODE_LIMIT_PER_IP = 40;
export const EMAIL_CODE_ATTEMPT_ACTION = "auth.email_code.attempt";

function digestKey() {
  // Derived from the server secret in the same way as other server-only signatures (utils/voting-room.ts).
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return secret ? createHash("sha256").update("outclass-email-code-attempt-v1\0" + secret).digest() : null;
}

export function attemptKey(kind: "email" | "ip", value: string) {
  const input = `${kind}\0${value.trim().toLowerCase()}`;
  const key = digestKey();
  const digest = key ? createHmac("sha256", key).update(input).digest("hex")
    : createHash("sha256").update(`outclass-email-code-v1\0${input}`).digest("hex");
  return `${kind}:${digest}`;
}

type AttemptTransaction = {
  $queryRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
  auditLog: {
    count(input: { where: { targetId: string; action: string; createdAt: { gt: Date } } }): Promise<number>;
    create(input: { data: { actorId: string; action: string; targetId: string } }): Promise<unknown>;
  };
};
type AttemptStore = { $transaction<T>(run: (tx: AttemptTransaction) => Promise<T>): Promise<T> };

/**
 * Reports whether the address and the network are both under their limits and, only then, records the
 * attempt. Database locks on both keys keep the count and the insert together across app instances.
 */
export async function recordEmailCodeAttempt(db: AttemptStore, email: string, ip: string | undefined, now = Date.now()) {
  const since = new Date(now - EMAIL_CODE_WINDOW_MS);
  const keys: Array<[string, number]> = [[attemptKey("email", email), EMAIL_CODE_LIMIT_PER_EMAIL]];
  if (ip) keys.push([attemptKey("ip", ip), EMAIL_CODE_LIMIT_PER_IP]);
  keys.sort(([a], [b]) => a < b ? -1 : 1);
  return db.$transaction(async tx => {
    for (const [targetId] of keys) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${targetId}, 0))::text`;
    for (const [targetId, limit] of keys) {
      if (await tx.auditLog.count({ where: { targetId, action: EMAIL_CODE_ATTEMPT_ACTION, createdAt: { gt: since } } }) >= limit) return false;
    }
    for (const [targetId] of keys) await tx.auditLog.create({ data: { actorId: "anonymous", action: EMAIL_CODE_ATTEMPT_ACTION, targetId } });
    return true;
  });
}
