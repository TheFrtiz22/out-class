import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { sameOriginRequest } from "@/lib/request-origin";
import { providerAuthFailure } from "@/lib/admin-failure";
import { DEMO_COOKIE } from "@/lib/demo/access";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
import { captchaFailed, turnstileMessage, withCaptcha } from "@/lib/turnstile";
import { recentlyAuthenticated, TWO_STEP_ATTEMPT_LIMIT, TWO_STEP_ATTEMPT_WINDOW, userMfaEnabled } from "@/lib/user-mfa";
import { freshAuthClient } from "@/utils/admin-elevation";
import { getSessionState } from "@/utils/auth";
import { sendTwoStepNoticeEmail } from "@/utils/email";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prisma";

const code = z.string().regex(/^\d{6}$/);
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enroll"), password: z.string().min(1).max(200).optional(), turnstileToken: z.string().max(2048).optional() }).strict(),
  z.object({ action: z.literal("confirm"), factorId: z.string().min(1).max(100), code }).strict(),
  z.object({ action: z.literal("challenge"), code }).strict(),
  z.object({ action: z.literal("disable"), code }).strict(),
]);
const noStore = { "Cache-Control": "private, no-store" };
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: noStore });
const tooMany = () => reply({ error: "Too many attempts. Try again in 15 minutes." }, 429);
const isPlatformAdmin = (id: string) => (process.env.OUTCLASS_PLATFORM_ADMIN_IDS || "").split(",").map(v => v.trim()).includes(id);

/** Optional two-step sign-in. Every call runs with the account's own Supabase session; the provider
 * stores factors and enforces assurance levels, and this route adds origin, flag and session gates. */
export async function POST(request: NextRequest) {
  if (!userMfaEnabled()) return reply({ error: "Not found." }, 404);
  if (!sameOriginRequest(request)) return reply({ error: "Invalid origin." }, 403);
  const jar = await cookies();
  if (jar.has(PLATFORM_VIEW_COOKIE) || jar.get(DEMO_COOKIE)?.value === "1") return reply({ error: "Two-step sign-in is unavailable in this session." }, 403);
  let body: unknown;
  try { body = await request.json(); } catch { return reply({ error: "Invalid request." }, 400); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return reply({ error: "Invalid request." }, 400);
  const input = parsed.data;
  try {
    const state = await getSessionState();
    const signedIn = state.identity.data.user;
    if (input.action === "challenge" ? !state.secondFactorPending && !signedIn : !signedIn || state.secondFactorPending)
      return reply({ error: "Sign in to continue." }, 401);
    const userId = (signedIn ?? state.pendingUser)!.id;
    const client = await createClient(jar);
    if (input.action === "challenge" && !state.secondFactorPending) return reply({ success: true });
    const factors = await client.auth.mfa.listFactors();
    if (factors.error) throw factors.error;
    const verified = factors.data.totp.filter(factor => factor.status === "verified");

    if (input.action === "enroll") {
      if (verified.length) return reply({ error: "Two-step sign-in is already on." }, 409);
      // A signed-in session alone cannot add a factor: the account re-authenticates first.
      const denied = await reauthenticate(signedIn!, input.password, input.turnstileToken, client);
      if (denied) return denied;
      // Abandoned set-ups leave unverified factors behind; clear them before starting again.
      for (const stale of factors.data.all.filter(factor => factor.factor_type === "totp" && factor.status !== "verified")) {
        const removed = await client.auth.mfa.unenroll({ factorId: stale.id });
        if (removed.error) throw removed.error;
      }
      const enrolled = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: `OutClass ${Date.now()}` });
      if (enrolled.error) throw enrolled.error;
      return reply({ factorId: enrolled.data.id, qr: enrolled.data.totp.qr_code, secret: enrolled.data.totp.secret });
    }

    if (input.action === "confirm") {
      if (verified.length) return reply({ error: "Two-step sign-in is already on." }, 409);
      const pending = factors.data.all.find(factor => factor.id === input.factorId && factor.factor_type === "totp" && factor.status !== "verified");
      if (!pending) return reply({ error: "Set-up expired. Start again." }, 400);
      const attempt = await recordAttempt(userId, CODE_ATTEMPT);
      if (!attempt) return tooMany();
      const result = await client.auth.mfa.challengeAndVerify({ factorId: pending.id, code: input.code });
      if (result.error) { if (providerAuthFailure(result.error)) return reply({ error: "That code didn't work. Try the current one." }, 400); throw result.error; }
      await attemptSucceeded(attempt);
      await audit(userId, "account.two-step.enable", pending.id);
      await notice(userId, signedIn!.email, true);
      return reply({ success: true });
    }

    const factor = verified[0];
    if (!factor) return input.action === "challenge" ? reply({ error: "Sign in to continue." }, 401) : reply({ error: "Two-step sign-in is already off." }, 409);
    if (input.action === "disable" && isPlatformAdmin(userId))
      return reply({ error: "Platform administrators must keep an authenticator." }, 403);
    // A fresh code is required both to finish signing in and to turn two-step sign-in off.
    // Each attempt is recorded before the provider sees the code, so guessing is capped per account.
    const attempt = await recordAttempt(userId, CODE_ATTEMPT);
    if (!attempt) return tooMany();
    const result = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: input.code });
    if (result.error) { if (providerAuthFailure(result.error)) return reply({ error: "That code didn't work. Try the current one." }, 400); throw result.error; }
    await attemptSucceeded(attempt);
    if (input.action === "challenge") return reply({ success: true });

    const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error || assurance.data?.currentLevel !== "aal2") return reply({ error: "Verify your code again to turn off two-step sign-in." }, 403);
    for (const each of verified) {
      const removed = await client.auth.mfa.unenroll({ factorId: each.id });
      if (removed.error) { if (providerAuthFailure(removed.error)) return reply({ error: "Verify your code again to turn off two-step sign-in." }, 403); throw removed.error; }
    }
    await audit(userId, "account.two-step.disable", factor.id);
    await notice(userId, signedIn!.email, false);
    return reply({ success: true });
  } catch (error) {
    if (providerAuthFailure(error)) return reply({ error: "Sign in again to continue." }, 401);
    console.error(JSON.stringify({ event: "two-step.failure", action: input.action, name: error instanceof Error ? error.name : "unknown" }));
    return reply({ error: "Two-step sign-in is temporarily unavailable." }, 503);
  }
}

async function audit(actorId: string, action: string, factorId: string | null, extra: Record<string, string | boolean> = {}) {
  try { await prisma.auditLog.create({ data: { actorId, action, targetId: actorId, details: factorId ? { factorId, ...extra } : extra } }); }
  catch { console.error(JSON.stringify({ event: "two-step.audit-failure", action })); }
}

const CODE_ATTEMPT = "user.two_step.attempt", PASSWORD_ATTEMPT = "user.two_step.password-attempt";

/**
 * Durable per-account attempt record, written before any provider call (the Admin elevation pattern,
 * on AuditLog rows). A transaction-scoped advisory lock serializes concurrent attempts for one account.
 * Only attempts that never succeeded count toward the limit. Returns null when the account is over it.
 */
async function recordAttempt(userId: string, action: string): Promise<string | null> {
  const since = new Date(Date.now() - TWO_STEP_ATTEMPT_WINDOW);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${"outclass-two-step:" + userId}))`;
    const failed = await tx.auditLog.count({ where: { actorId: userId, action, createdAt: { gte: since }, details: { path: ["result"], equals: "attempt" } } });
    if (failed >= TWO_STEP_ATTEMPT_LIMIT) return null;
    const row = await tx.auditLog.create({ data: { actorId: userId, action, targetId: userId, details: { result: "attempt" } } });
    return row.id;
  });
}
async function attemptSucceeded(id: string) {
  await prisma.auditLog.update({ where: { id }, data: { details: { result: "success" } } });
}

type VerifiedUser = { id: string; email?: string | null; app_metadata?: Record<string, unknown> };
/**
 * Re-authentication before enrolling, the same rule as the account-deletion request: accounts with a
 * password re-enter it, checked on a throwaway Auth client (as in the Admin password re-check) so the
 * browser session is untouched; university sign-in accounts have no password and must have signed in
 * within the last 10 minutes (the verified `amr` claim).
 */
async function reauthenticate(user: VerifiedUser, password: string | undefined, turnstileToken: string | undefined, client: Awaited<ReturnType<typeof createClient>>): Promise<NextResponse | null> {
  const providers = user.app_metadata?.providers;
  const passwordAccount = Array.isArray(providers) ? providers.includes("email") : user.app_metadata?.provider === "email";
  if (!passwordAccount) {
    const { data, error } = await client.auth.getClaims();
    if (error || !recentlyAuthenticated(data?.claims?.amr)) return reply({ error: "For your security, sign out and sign back in, then turn on two-step sign-in within 10 minutes." }, 403);
    return null;
  }
  if (!password || !user.email) return reply({ error: "Enter your current password." }, 403);
  if (!await recordAttempt(user.id, PASSWORD_ATTEMPT)) return tooMany();
  const fresh = freshAuthClient();
  const signed = await fresh.auth.signInWithPassword(withCaptcha({ email: user.email, password }, turnstileToken));
  if (captchaFailed(signed.error)) return reply({ error: turnstileMessage("rejected") }, 403);
  if (signed.error && !providerAuthFailure(signed.error)) throw signed.error;
  if (signed.error || !signed.data.session || signed.data.user?.id !== user.id) return reply({ error: "That password isn’t right." }, 403);
  // Close the verification session only; never sign the person out elsewhere.
  await fresh.auth.signOut({ scope: "local" }).catch(() => undefined);
  return null;
}

/** Best effort: the change already happened, so a mail outage is logged and audited, not surfaced. */
async function notice(userId: string, email: string | null | undefined, enabled: boolean) {
  const eventId = randomUUID();
  let result = "sent";
  try { if (!email) throw Error("No email"); await sendTwoStepNoticeEmail({ recipient: email, enabled, eventId }); }
  catch { result = "failed"; console.error(JSON.stringify({ event: "two-step.notice-failure", enabled })); }
  await audit(userId, "account.two-step.email", null, { eventId, enabled, result });
}
