import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { sameOriginRequest } from "@/lib/request-origin";
import { providerAuthFailure } from "@/lib/admin-failure";
import { DEMO_COOKIE } from "@/lib/demo/access";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
import { userMfaEnabled } from "@/lib/user-mfa";
import { getSessionState } from "@/utils/auth";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prisma";

const code = z.string().regex(/^\d{6}$/);
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enroll") }).strict(),
  z.object({ action: z.literal("confirm"), factorId: z.string().min(1).max(100), code }).strict(),
  z.object({ action: z.literal("challenge"), code }).strict(),
  z.object({ action: z.literal("disable"), code }).strict(),
]);
const noStore = { "Cache-Control": "private, no-store" };
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: noStore });
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
      const result = await client.auth.mfa.challengeAndVerify({ factorId: pending.id, code: input.code });
      if (result.error) { if (providerAuthFailure(result.error)) return reply({ error: "That code didn't work. Try the current one." }, 400); throw result.error; }
      await audit(userId, "account.two-step.enable", pending.id);
      return reply({ success: true });
    }

    const factor = verified[0];
    if (!factor) return input.action === "challenge" ? reply({ error: "Sign in to continue." }, 401) : reply({ error: "Two-step sign-in is already off." }, 409);
    if (input.action === "disable" && isPlatformAdmin(userId))
      return reply({ error: "Platform administrators must keep an authenticator." }, 403);
    // A fresh code is required both to finish signing in and to turn two-step sign-in off.
    const result = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: input.code });
    if (result.error) { if (providerAuthFailure(result.error)) return reply({ error: "That code didn't work. Try the current one." }, 400); throw result.error; }
    if (input.action === "challenge") return reply({ success: true });

    const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error || assurance.data?.currentLevel !== "aal2") return reply({ error: "Verify your code again to turn off two-step sign-in." }, 403);
    for (const each of verified) {
      const removed = await client.auth.mfa.unenroll({ factorId: each.id });
      if (removed.error) { if (providerAuthFailure(removed.error)) return reply({ error: "Verify your code again to turn off two-step sign-in." }, 403); throw removed.error; }
    }
    await audit(userId, "account.two-step.disable", factor.id);
    return reply({ success: true });
  } catch (error) {
    if (providerAuthFailure(error)) return reply({ error: "Sign in again to continue." }, 401);
    console.error(JSON.stringify({ event: "two-step.failure", action: input.action, name: error instanceof Error ? error.name : "unknown" }));
    return reply({ error: "Two-step sign-in is temporarily unavailable." }, 503);
  }
}

async function audit(actorId: string, action: string, factorId: string) {
  try { await prisma.auditLog.create({ data: { actorId, action, targetId: actorId, details: { factorId } } }); }
  catch { console.error(JSON.stringify({ event: "two-step.audit-failure", action })); }
}
