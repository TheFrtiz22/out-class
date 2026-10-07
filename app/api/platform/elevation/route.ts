import { sameOriginRequest } from "@/lib/request-origin";
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { requirePlatformAdminEligibility } from "@/utils/platform-admin";
import { prisma } from "@/utils/prisma";
import { createClient } from "@/utils/supabase/server";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
import { authSessionId, freshAuthClient, elevationHash, encryptChallenge, decryptChallenge } from "@/utils/admin-elevation";
import { ADMIN_CHALLENGE_COOKIE, ADMIN_ELEVATION_COOKIE, ADMIN_CHALLENGE_LIFETIME, ADMIN_ELEVATION_LIFETIME, adminCookieOptions } from "@/lib/admin-elevation";
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("password"), password: z.string().min(1).max(200) }).strict(),
  z.object({ action: z.literal("verify"), code: z.string().regex(/^\d{6}$/) }).strict(),
  z.object({ action: z.literal("end") }).strict(),
]);
export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  let actorId: string | undefined;
  try {
    const jar = await cookies();
    if (jar.has(PLATFORM_VIEW_COOKIE)) throw Error("Return from impersonation before authenticating.");
    const actor = await requirePlatformAdminEligibility(); actorId = actor.id;
    const input = inputSchema.parse(await request.json());
    const normalSession = await authSessionId();
    if (input.action === "end") {
      await prisma.$transaction(async tx => {
        await tx.adminElevation.updateMany({ where: { actorId: actor.id, authSessionId: normalSession, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.adminElevationChallenge.updateMany({ where: { actorId: actor.id, authSessionId: normalSession, consumedAt: null }, data: { consumedAt: new Date(), encryptedCredentials: "" } });
        await tx.auditLog.create({ data: { actorId: actor.id, action: "platform.elevation.end", targetId: actor.id, details: { result: "revoked" } } });
      });
      jar.set(ADMIN_ELEVATION_COOKIE, "", { ...adminCookieOptions, maxAge: 0 });
      jar.set(ADMIN_CHALLENGE_COOKIE, "", { ...adminCookieOptions, maxAge: 0 });
      return NextResponse.json({ success: true });
    }
    if (input.action === "password") {
      const since = new Date(Date.now() - 15 * 60000);
      // Durable attempts, recorded before provider calls, serialize concurrent password attempts.
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${actor.id} FOR UPDATE`;
        if (await tx.auditLog.count({ where: { actorId: actor.id, action: "platform.elevation.password-attempt", createdAt: { gte: since } } }) >= 5) throw Error("Too many attempts. Try again in 15 minutes.");
        await tx.auditLog.create({ data: { actorId: actor.id, action: "platform.elevation.password-attempt", targetId: actor.id, details: { result: "attempt" } } });
      });
      const client = freshAuthClient();
      const signed = await client.auth.signInWithPassword({ email: actor.email, password: input.password });
      if (signed.error || !signed.data.session || signed.data.user?.id !== actor.id) throw Error("Password verification failed.");
      const passwordVerifiedAt = new Date();
      const factors = await client.auth.mfa.listFactors();
      if (factors.error) throw Error("Authenticator unavailable.");
      const factor = factors.data.totp.find(f => f.status === "verified");
      let factorId = factor?.id, qr: string | undefined;
      if (!factorId) {
        const enrollment = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "OutClass Admin " + Date.now() });
        if (enrollment.error) throw Error("Enroll an authenticator before continuing.");
        factorId = enrollment.data.id; qr = enrollment.data.totp.qr_code;
      }
      const challenge = await client.auth.mfa.challenge({ factorId });
      if (challenge.error) throw Error("Authenticator challenge failed.");
      const token = randomBytes(32).toString("hex");
      const now = new Date();
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${actor.id} FOR UPDATE`;
        await tx.adminElevationChallenge.updateMany({ where: { actorId: actor.id, consumedAt: null }, data: { consumedAt: now, encryptedCredentials: "" } });
        await tx.adminElevationChallenge.create({ data: { actorId: actor.id, tokenHash: elevationHash(token), authSessionId: normalSession, encryptedCredentials: encryptChallenge(signed.data.session!), factorId: factorId!, providerChallengeId: challenge.data.id, passwordVerifiedAt, createdAt: now, expiresAt: new Date(now.getTime() + ADMIN_CHALLENGE_LIFETIME) } });
      });
      jar.set(ADMIN_CHALLENGE_COOKIE, token, { ...adminCookieOptions, maxAge: ADMIN_CHALLENGE_LIFETIME / 1000 });
      return NextResponse.json({ step: "mfa", qr }, { headers: { "Cache-Control": "no-store" } });
    }
    const raw = jar.get(ADMIN_CHALLENGE_COOKIE)?.value;
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) throw Error("Start with fresh password verification.");
    const tokenHash = elevationHash(raw);
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "AdminElevationChallenge" WHERE "tokenHash"=${tokenHash} FOR UPDATE`;
      const challenge = await tx.adminElevationChallenge.findUnique({ where: { tokenHash } });
      if (!challenge || challenge.actorId !== actor.id || challenge.authSessionId !== normalSession || challenge.consumedAt || challenge.expiresAt <= new Date() || challenge.attempts >= 5) throw Error("Authentication challenge expired or unavailable.");
      // Commit failed attempt counts rather than rolling them back with a thrown error.
      await tx.adminElevationChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      const client = freshAuthClient();
      const session = await client.auth.setSession(decryptChallenge(challenge.encryptedCredentials));
      if (session.error) return { error: "Authentication challenge unavailable." };
      const verified = await client.auth.mfa.verify({ factorId: challenge.factorId, challengeId: challenge.providerChallengeId, code: input.code });
      if (verified.error) return { error: "Authenticator verification failed." };
      const identity = await client.auth.getUser(verified.data.access_token);
      const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      const claims = await client.auth.getClaims(verified.data.access_token);
      if (identity.error || identity.data.user?.id !== actor.id || assurance.error || assurance.data?.currentLevel !== "aal2" || claims.error || typeof claims.data?.claims.session_id !== "string") return { error: "Fresh MFA evidence could not be verified." };
      // Recheck authority after the external password/MFA operations and under the actor lock.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${actor.id} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: actor.id } });
      const grant = await tx.platformAdmin.findUnique({ where: { userId: actor.id } });
      if (!user || user.disabledAt || !grant?.active || !(process.env.OUTCLASS_PLATFORM_ADMIN_IDS || "").split(",").map(v => v.trim()).includes(actor.id)) return { error: "Administrator access was revoked." };
      if (challenge.expiresAt <= new Date()) return { error: "Authentication challenge expired. Start again." };
      const now = new Date(), elevationToken = randomBytes(32).toString("hex");
      await tx.adminElevation.updateMany({ where: { actorId: actor.id, revokedAt: null }, data: { revokedAt: now } });
      const elevation = await tx.adminElevation.create({ data: { actorId: actor.id, tokenHash: elevationHash(elevationToken), authSessionId: claims.data.claims.session_id, factorId: challenge.factorId, passwordVerifiedAt: challenge.passwordVerifiedAt, mfaVerifiedAt: now, createdAt: now, expiresAt: new Date(now.getTime() + ADMIN_ELEVATION_LIFETIME) } });
      await tx.adminElevationChallenge.update({ where: { id: challenge.id }, data: { consumedAt: now, encryptedCredentials: "" } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: "platform.elevation.create", targetId: elevation.id, details: { result: "success", factorId: challenge.factorId, expiresAt: elevation.expiresAt.toISOString() } } });
      return { elevationToken, session: { access_token: verified.data.access_token, refresh_token: verified.data.refresh_token } };
    }, { timeout: 20000 });
    if ("error" in result) throw Error(result.error);
    const normal = await createClient(jar);
    const attached = await normal.auth.setSession(result.session);
    if (attached.error) throw Error("Could not attach verified sign-in. Authenticate again.");
    jar.set(ADMIN_ELEVATION_COOKIE, result.elevationToken, { ...adminCookieOptions, maxAge: ADMIN_ELEVATION_LIFETIME / 1000 });
    jar.set(ADMIN_CHALLENGE_COOKIE, "", { ...adminCookieOptions, maxAge: 0 });
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (actorId) await prisma.auditLog.create({ data: { actorId, action: "platform.elevation.failure", targetId: actorId, details: { result: "denied" } } });
    return NextResponse.json({ error: error instanceof Error && !error.message.includes("Zod") ? error.message : "Admin authentication failed." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
}
