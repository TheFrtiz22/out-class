import { createHash, createHmac } from "node:crypto";
import { setPasswordAfterConfirmation } from "@/lib/signup-password";

// Server-only helpers for /api/auth/confirm-email.

/** One response for a wrong or expired code, so the two cannot be told apart. Limited attempts get EMAIL_CODE_LIMITED. */
export const EMAIL_CODE_REJECTED = "That code isn't valid or has expired. Check it or send yourself a new one.";

/** Shown after a valid code when an account that has not finished setup already has a second factor. */
export const EMAIL_CODE_FACTOR_BLOCKED = "This account uses two-step sign-in. Sign in with your password and authenticator, or reset your password.";

/** Accounts confirmed before the confirmation route shipped keep their password and sessions. */
export const PASSWORD_REVIEW_START = "2026-11-10T00:00:00.000Z";

export const PASSWORD_SECURED_KEY = "outclass_password_secured";

type ConfirmedUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  invited_at?: string | null;
  app_metadata?: Record<string, unknown> | null;
  factors?: { status?: string }[] | null;
};

/** True when the account has a verified second factor (TOTP), which the confirmation steps never change. */
export function hasVerifiedFactor(user: Pick<ConfirmedUser, "factors">) {
  return (user.factors ?? []).some(factor => factor?.status === "verified");
}

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
    mfa: { listFactors(input: { userId: string }): Promise<{ data: { factors?: { status?: string }[] | null } | null; error: unknown }> };
    updateUserById(id: string, input: { password?: string; app_metadata?: Record<string, unknown> }): Promise<{ error: unknown }>;
    generateLink(input: { type: "magiclink"; email: string }): Promise<{ data: { properties?: { hashed_token?: string } | null } | null; error: unknown }>;
  } };
};

async function succeeded(call: () => Promise<{ error: unknown }>) {
  try { return !(await call()).error; } catch { return false; }
}

/**
 * Reads the account's factors with the service role, so the result does not depend on whether the session
 * response lists them. Returns null when they cannot be read.
 */
async function adminHasVerifiedFactor(admin: AdminClient, userId: string) {
  try {
    const listed = await admin.auth.admin.mfa.listFactors({ userId });
    if (listed.error || !Array.isArray(listed.data?.factors)) return null;
    return hasVerifiedFactor({ factors: listed.data.factors });
  } catch { return null; }
}

/**
 * Keeps only the password supplied with the code (or an unusable one) and signs out every other session.
 *
 * 1. The verified session sets the supplied password, which checks it against Auth's rules.
 * 2. The service role sets the final password. Supabase Auth ends every session of the account when an
 *    administrator sets a password, so a change made from another session before this step does not remain.
 * 3. The same client receives a new session through a one-time server-generated sign-in token (no email is
 *    sent) and signs out any other session that remains.
 * 4. That session sets the final password again (Auth answers same_password when nothing changed it) and
 *    signs out other sessions once more, so the result does not depend on step 2 ending sessions.
 * 5. The record is written last.
 *
 * An account that already has a verified second factor is left unchanged: whether that factor belongs to
 * the address owner cannot be told here, so the caller refuses and the owner uses password recovery. The
 * factors are read through the service role before any change; if they cannot be read, nothing changes.
 *
 * Each step is safe to repeat, so a later verification finishes an incomplete one. The new session is
 * returned for the caller to attach.
 */
export async function secureVerifiedAccount(client: SessionClient, admin: AdminClient, user: ConfirmedUser, password: string | undefined) {
  const blocked = { passwordSaved: false, secured: false, recorded: false, session: null, factorBlocked: true };
  if (hasVerifiedFactor(user)) return blocked;
  // Checked again through the service role before anything changes; when the factors cannot be read, nothing changes.
  const factor = await adminHasVerifiedFactor(admin, user.id);
  if (factor === null) return { ...blocked, factorBlocked: false };
  if (factor) return blocked;
  const saved = (await setPasswordAfterConfirmation(client, password)).saved;
  const finalPassword = saved ? password! : unusablePassword();
  const failed = { passwordSaved: saved, secured: false, recorded: false, session: null, factorBlocked: false };
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
  // Set the final password again from the only remaining session, then sign out any other session again.
  if (!(await setPasswordAfterConfirmation(client, finalPassword)).saved) return failed;
  if (!(await succeeded(() => client.auth.signOut({ scope: "others" })))) return failed;
  const recorded = await succeeded(() => admin.auth.admin.updateUserById(user.id, {
    app_metadata: { [PASSWORD_SECURED_KEY]: { userId: user.id, email: user.email?.trim().toLowerCase(), securedAt: new Date().toISOString() } },
  }));
  return { passwordSaved: saved, secured: true, recorded, session, factorBlocked: false };
}

// Failed code attempts per address and client network, failed attempts per address across all networks,
// and all attempts per client network, from append-only audit rows.
export const EMAIL_CODE_WINDOW_MS = 15 * 60 * 1000;
/** Failed attempts for one address from one client network. */
export const EMAIL_CODE_LIMIT_PER_EMAIL_IP = 8;
/** Failed attempts for one address across all networks: bounds guessing, and is high enough that one network cannot use it up. */
export const EMAIL_CODE_LIMIT_PER_EMAIL = 50;
/** All attempts from one client network. */
export const EMAIL_CODE_LIMIT_PER_IP = 120;
export const EMAIL_CODE_ATTEMPT_ACTION = "auth.email_code.attempt";
export const EMAIL_CODE_SUCCESS_ACTION = "auth.email_code.success";
/** Shown for any address once a limit is reached, whether or not an account exists. */
export const EMAIL_CODE_LIMITED = "Too many attempts. Wait 15 minutes, then request a new code.";

function digestKey() {
  // Derived from the server secret in the same way as other server-only signatures (utils/voting-room.ts).
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Email code attempt digests need the Supabase secret key.");
  return createHash("sha256").update("outclass-email-code-attempt-v1\0" + secret).digest();
}

export function attemptKey(kind: "email" | "ip" | "email-ip", value: string) {
  return `${kind}:${createHmac("sha256", digestKey()).update(`${kind}\0${value.trim().toLowerCase()}`).digest("hex")}`;
}

/** Requests without a valid client address share one network bucket per address. */
function pairKey(email: string, ip: string | undefined) {
  return attemptKey("email-ip", `${email.trim().toLowerCase()}\0${ip ?? "unknown"}`);
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
 * Reserves one attempt when the address has fewer unrefunded attempts than the limit from this network and
 * than the higher limit across all networks, and the network is under its limit; otherwise records
 * nothing. Database locks on every key keep the counts and the inserts together across app instances. A
 * successful verification refunds the attempt for the address and for the address on that network.
 */
export async function recordEmailCodeAttempt(db: AttemptStore, email: string, ip: string | undefined, now = Date.now()) {
  const since = new Date(now - EMAIL_CODE_WINDOW_MS);
  const emailKey = attemptKey("email", email), emailIpKey = pairKey(email, ip), ipKey = ip ? attemptKey("ip", ip) : null;
  const keys = [emailKey, emailIpKey, ...(ipKey ? [ipKey] : [])].sort();
  return db.$transaction(async tx => {
    for (const targetId of keys) await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${targetId}, 0))`;
    const count = (targetId: string, action: string) => tx.auditLog.count({ where: { targetId, action, createdAt: { gt: since } } });
    const failed = async (targetId: string) => await count(targetId, EMAIL_CODE_ATTEMPT_ACTION) - await count(targetId, EMAIL_CODE_SUCCESS_ACTION);
    if (await failed(emailIpKey) >= EMAIL_CODE_LIMIT_PER_EMAIL_IP) return false;
    if (await failed(emailKey) >= EMAIL_CODE_LIMIT_PER_EMAIL) return false;
    if (ipKey && await count(ipKey, EMAIL_CODE_ATTEMPT_ACTION) >= EMAIL_CODE_LIMIT_PER_IP) return false;
    for (const targetId of keys) await tx.auditLog.create({ data: { actorId: "anonymous", action: EMAIL_CODE_ATTEMPT_ACTION, targetId } });
    return true;
  });
}

/** A verified code does not count toward the address's limits. */
export async function recordEmailCodeSuccess(db: { auditLog: AttemptTransaction["auditLog"] }, email: string, ip: string | undefined) {
  for (const targetId of [attemptKey("email", email), pairKey(email, ip)])
    await db.auditLog.create({ data: { actorId: "anonymous", action: EMAIL_CODE_SUCCESS_ACTION, targetId } });
}
