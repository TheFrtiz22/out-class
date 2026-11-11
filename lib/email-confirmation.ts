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

type Session = { access_token: string; refresh_token: string; user: { id: string } };
type SessionClient = {
  auth: {
    updateUser(input: { password: string }): Promise<{ error: { code?: string; status?: number } | null }>;
    signOut(input: { scope: "others" }): Promise<{ error: unknown }>;
    verifyOtp(input: { token_hash: string; type: "magiclink" }): Promise<{ data: { session: Session | null }; error: unknown }>;
  };
};
type AdminClient = {
  auth: { admin: {
    updateUserById(id: string, input: { password?: string; app_metadata?: Record<string, unknown> }): Promise<{ error: unknown }>;
    generateLink(input: { type: "magiclink"; email: string }): Promise<{ data: { properties?: { hashed_token?: string } | null } | null; error: unknown }>;
  } };
};

async function succeeded(call: () => Promise<{ error: unknown }>) {
  try { return !(await call()).error; } catch { return false; }
}

/**
 * Keeps only the password supplied with the code (or an unusable one) and signs out every other session.
 *
 * 1. The verified session sets the supplied password, which checks it against Auth's rules.
 * 2. The service role sets the final password. Supabase Auth ends every session of the account when an
 *    administrator sets a password, so a change made from another session before this step does not remain.
 * 3. The same client receives a new session through a one-time server-generated sign-in token (no email is
 *    sent) and signs out any other session that remains.
 * 4. The record is written last.
 *
 * Each step is safe to repeat, so a later verification finishes an incomplete one. The new session is
 * returned for the caller to attach.
 */
export async function secureVerifiedAccount(client: SessionClient, admin: AdminClient, user: ConfirmedUser, password: string | undefined) {
  const saved = (await setPasswordAfterConfirmation(client, password)).saved;
  const finalPassword = saved ? password! : unusablePassword();
  const failed = { passwordSaved: saved, secured: false, recorded: false, session: null };
  if (!user.email || !(await succeeded(() => admin.auth.admin.updateUserById(user.id, { password: finalPassword })))) return failed;
  let session: Session | null = null;
  try {
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
    const tokenHash = link.data?.properties?.hashed_token;
    if (!link.error && tokenHash) {
      const fresh = await client.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (!fresh.error && fresh.data.session?.user.id === user.id) session = fresh.data.session;
    }
  } catch { session = null; }
  if (!session || !(await succeeded(() => client.auth.signOut({ scope: "others" })))) return failed;
  const recorded = await succeeded(() => admin.auth.admin.updateUserById(user.id, {
    app_metadata: { [PASSWORD_SECURED_KEY]: { userId: user.id, email: user.email?.trim().toLowerCase(), securedAt: new Date().toISOString() } },
  }));
  return { passwordSaved: saved, secured: true, recorded, session };
}

// Failed code attempts per address and all code attempts per client network, from append-only audit rows.
export const EMAIL_CODE_WINDOW_MS = 15 * 60 * 1000;
export const EMAIL_CODE_LIMIT_PER_EMAIL = 8;
export const EMAIL_CODE_LIMIT_PER_IP = 120;
export const EMAIL_CODE_ATTEMPT_ACTION = "auth.email_code.attempt";
export const EMAIL_CODE_SUCCESS_ACTION = "auth.email_code.success";
/** Shown for any address once its limit is reached, whether or not an account exists. */
export const EMAIL_CODE_LIMITED = "Too many attempts. Wait 15 minutes, then request a new code.";

function digestKey() {
  // Derived from the server secret in the same way as other server-only signatures (utils/voting-room.ts).
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Email code attempt digests need the Supabase secret key.");
  return createHash("sha256").update("outclass-email-code-attempt-v1\0" + secret).digest();
}

export function attemptKey(kind: "email" | "ip", value: string) {
  return `${kind}:${createHmac("sha256", digestKey()).update(`${kind}\0${value.trim().toLowerCase()}`).digest("hex")}`;
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
 * Reserves one attempt when the address has fewer than the limit of unrefunded attempts and the network is
 * under its limit; otherwise records nothing. Database locks on both keys keep the count and the insert
 * together across app instances. A successful verification refunds the address's attempt.
 */
export async function recordEmailCodeAttempt(db: AttemptStore, email: string, ip: string | undefined, now = Date.now()) {
  const since = new Date(now - EMAIL_CODE_WINDOW_MS);
  const emailKey = attemptKey("email", email), ipKey = ip ? attemptKey("ip", ip) : null;
  const keys = [emailKey, ...(ipKey ? [ipKey] : [])].sort();
  return db.$transaction(async tx => {
    for (const targetId of keys) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${targetId}, 0))::text`;
    const count = (targetId: string, action: string) => tx.auditLog.count({ where: { targetId, action, createdAt: { gt: since } } });
    const failed = await count(emailKey, EMAIL_CODE_ATTEMPT_ACTION) - await count(emailKey, EMAIL_CODE_SUCCESS_ACTION);
    if (failed >= EMAIL_CODE_LIMIT_PER_EMAIL) return false;
    if (ipKey && await count(ipKey, EMAIL_CODE_ATTEMPT_ACTION) >= EMAIL_CODE_LIMIT_PER_IP) return false;
    for (const targetId of keys) await tx.auditLog.create({ data: { actorId: "anonymous", action: EMAIL_CODE_ATTEMPT_ACTION, targetId } });
    return true;
  });
}

/** A verified code does not count toward the address's limit. */
export async function recordEmailCodeSuccess(db: { auditLog: AttemptTransaction["auditLog"] }, email: string) {
  await db.auditLog.create({ data: { actorId: "anonymous", action: EMAIL_CODE_SUCCESS_ACTION, targetId: attemptKey("email", email) } });
}
