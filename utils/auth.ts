import { serverPhase } from "@/lib/server-phase-trace";
import { AdminAccessError, providerAuthFailure } from "@/lib/admin-failure";
import { assertClubOperational } from "@/lib/club-suspension";
import { createClient as createAdminClient, type User as AuthUser } from "@supabase/supabase-js";
import { platformViewSession } from "@/utils/platform-view-as";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
import { hasPermission, isActiveMembership, type ClubPermission } from "@/lib/permissions";
import { DEMO_COOKIE } from "@/lib/demo/access";
import { isUvaEmail } from "@/lib/auth";
import { sessionIdFromVerifiedToken } from "@/lib/auth-session";
import { secondFactorPending, TWO_STEP_REQUIRED_MESSAGE, twoStepChallengeHref } from "@/lib/user-mfa";
import { createClient } from "./supabase/server";
import { cookies, headers } from "next/headers";
import { prisma } from "./prisma";
import { redirect } from "next/navigation";
import { cache } from "react";

// React's request cache is limited to one server render/request. It never shares
// a verified identity between requests, users, clubs, or support sessions.
export const getSessionState = cache(async () => {
  const supabase = await createClient(await cookies());
  // getSession only supplies a candidate token; verify that exact token remotely
  // before trusting its session claim. This retains one getUser verification.
  const session = await supabase.auth.getSession();
  if (session.error || !session.data.session) return { identity: { data: { user: null }, error: session.error }, secondFactorPending: false };
  const token = session.data.session.access_token;
  const identity = await serverPhase("identity", () => supabase.auth.getUser(token));
  if (identity.error || !identity.data.user) return { identity, secondFactorPending: false };
  const sessionId = sessionIdFromVerifiedToken(token, identity.data.user.id);
  if (!sessionId) return { identity: { data: { user: null }, error: null }, secondFactorPending: false };
  // Auth can accept an unexpired JWT beyond the session's not_after boundary.
  // Request caching coalesces this indexed check, never across requests/users.
  const [row] = await serverPhase("live_session", () => prisma.$queryRaw<{ live: boolean }[]>`
    SELECT EXISTS(SELECT 1 FROM auth.sessions WHERE id=${sessionId}::uuid
      AND user_id=${identity.data.user.id}::uuid
      AND (not_after IS NULL OR not_after>clock_timestamp())) AS live`);
  if (!row?.live) return { identity: { data: { user: null }, error: null }, secondFactorPending: false };
  // Optional two-step sign-in: factors come from the verified Auth user, the level from the
  // verified token. An enrolled account that has not passed its code is not signed in yet.
  if (secondFactorPending(identity.data.user, token))
    return { identity: { data: { user: null }, error: null }, secondFactorPending: true, pendingUser: identity.data.user };
  return { identity, secondFactorPending: false };
});
export const getSessionUser = cache(async () => (await getSessionState()).identity);

/**
 * Ensures a user is logged in. Returns the Supabase user and Prisma user.
 * Redirects to /auth (or home) if not authenticated.
 */
export async function requireAuth(options: { allowPlatformView?: boolean; verifyEmail?: boolean; adminDiagnostics?: boolean } = {}) {
  const cookieStore = await cookies();
  if (cookieStore.has(PLATFORM_VIEW_COOKIE) && !options.allowPlatformView) {
    const session = await serverPhase("identity", () => platformViewSession());
    if (!session) throw new Error("Impersonation expired or unavailable. Exit impersonation to continue.");
    const effective = await prisma.user.findUnique({ where: { id: session.targetUserId } });
    if (!effective || effective.disabledAt) throw new Error("This account is unavailable.");
    // Only operations which need provider verification fetch the target's Auth record.
    // No target tokens are created or returned, and the original login is never changed.
    if (options.verifyEmail) {
      const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!secret) throw new Error("Target email verification is unavailable.");
      const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", secret, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await serverPhase("identity", () => admin.auth.admin.getUserById(effective.id));
      if (error || !data.user || data.user.id !== effective.id || data.user.email?.toLowerCase() !== effective.email.toLowerCase()) throw new Error("Target email verification is unavailable.");
      const supabaseUser: Pick<AuthUser, "id" | "email" | "email_confirmed_at" | "confirmation_sent_at" | "app_metadata" | "identities"> = { id: effective.id, email: effective.email, email_confirmed_at: data.user.email_confirmed_at, confirmation_sent_at: data.user.confirmation_sent_at, app_metadata: data.user.app_metadata, identities: data.user.identities };
      return { user: effective, supabaseUser, impersonation: session };
    }
    // Never borrow the administrator's Auth metadata or verified-email status.
    return { user: effective, supabaseUser: { id: effective.id, email: effective.email, email_confirmed_at: undefined, app_metadata: {} }, impersonation: session };
  }
  if (cookieStore.get(DEMO_COOKIE)?.value === "1") throw new AdminAccessError("ADMIN_ACCESS_DENIED", "Live data is unavailable in Demo Mode.");
  const state = await getSessionState();
  if (state.secondFactorPending) {
    if (options.adminDiagnostics) throw new AdminAccessError("ADMIN_MFA_REQUIRED", TWO_STEP_REQUIRED_MESSAGE);
    // Server Actions are refused outright; page renders go to the code challenge.
    if ((await headers()).has("next-action")) throw new Error(TWO_STEP_REQUIRED_MESSAGE);
    redirect(twoStepChallengeHref("/"));
  }
  const { data: { user }, error } = state.identity;

  if (options.adminDiagnostics && error && !providerAuthFailure(error)) throw error;
  if (error || !user || !user.email || !isUvaEmail(user.email) || !user.email_confirmed_at) {
    if (options.adminDiagnostics) throw new AdminAccessError("ADMIN_AUTH_REQUIRED", "Sign-in required.");
    redirect("/"); // Redirect to login page
  }

  // Fetch the Prisma user to get global roles
  const existingUser = await prisma.user.findUnique({ where: { id: user.id } });
  const prismaUser = cookieStore.has(PLATFORM_VIEW_COOKIE) || existingUser?.email === user.email ? existingUser : await prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email },
    create: { id: user.id, email: user.email!, role: "STUDENT" },
  });

  if (!prismaUser || prismaUser.disabledAt) {
    // Edge case: Trigger failed or user was deleted from Prisma but not Supabase
    if (options.adminDiagnostics) throw new AdminAccessError("ADMIN_AUTH_REQUIRED", "Sign-in required.");
    redirect("/");
  }

  // Maintenance mode: every authenticated Server Action (the product's write path) is refused
  // for non-admins. Page renders and GET reads are unaffected; product routes show the
  // maintenance page instead. Admin entry points (adminDiagnostics) verify admin authority
  // themselves, and support sessions above already belong to a verified platform admin.
  if (!options.adminDiagnostics && (await headers()).has("next-action")) {
    const { assertSiteWritable } = await import("@/utils/site-settings");
    await assertSiteWritable(prismaUser.id);
  }

  return { supabaseUser: user, user: prismaUser, impersonation: null };
}

/** Every sensitive club operation checks the current database membership. */
export async function requireClubPermission(clubId: string, permissions: ClubPermission[], options: { allowSuspendedRead?: boolean } = {}) {
  const { user } = await requireAuth();
  const membership = await prisma.clubMember.findUnique({ where: { userId_clubId: { userId: user.id, clubId } } });
  if (!membership || !isActiveMembership(membership) || !permissions.every(permission => hasPermission(membership, permission))) {
    throw new Error("You do not have permission for this club action.");
  }
  if (!options.allowSuspendedRead) await assertClubOperational(prisma, clubId);
  return { user, membership };
}
export async function requireClubMembership(clubId: string) {
  return requireClubPermission(clubId, []);
}
