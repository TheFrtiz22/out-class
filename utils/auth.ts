import { ActionError } from "@/lib/action-result";
import { serverPhase } from "@/lib/server-phase-trace";
import { AdminAccessError, providerAuthFailure } from "@/lib/admin-failure";
import { assertClubOperational } from "@/lib/club-suspension";
import { createClient as createAdminClient, type User as AuthUser } from "@supabase/supabase-js";
import { platformViewSession } from "@/utils/platform-view-as";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
import { hasPermission, isActiveMembership, type ClubPermission } from "@/lib/permissions";
import { graduateMemberFor, readGraduation } from "@/lib/graduate-access";
import { DEMO_COOKIE } from "@/lib/demo/access";
import { isUvaEmail, safeReturnPath } from "@/lib/auth";
import { sessionIdFromVerifiedToken } from "@/lib/auth-session";
import { RETURN_PATH_HEADER, secondFactorPending, TWO_STEP_REQUIRED_MESSAGE, twoStepChallengeHref } from "@/lib/user-mfa";
import { createClient } from "./supabase/server";
import { mobileRequest } from "./mobile-request";
import { cookies, headers } from "next/headers";
import { prisma } from "./prisma";
import { redirect } from "next/navigation";
import { cache } from "react";

type SessionVerifier = { auth: { getUser(token: string): ReturnType<Awaited<ReturnType<typeof createClient>>["auth"]["getUser"]> } };
/** One verification for both entries: the exact token is verified remotely, bound to a live
 * auth.sessions row, and held back while a second factor is pending. */
async function verifiedSessionState(supabase: SessionVerifier, token: string) {
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
}
type SessionState = Awaited<ReturnType<typeof verifiedSessionState>>;

// React's request cache is limited to one server render/request. It never shares
// a verified identity between requests, users, clubs, or support sessions.
export const getSessionState = cache(async () => {
  // The native app: only utils/mobile-api.ts opens this context (utils/mobile-request.ts).
  // Its bearer token gets the same verification as a cookie session; cookies are not consulted.
  const mobile = mobileRequest();
  if (mobile) {
    mobile.session ??= verifiedSessionState(createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }), mobile.token);
    return mobile.session as Promise<SessionState>;
  }
  const supabase = await createClient(await cookies());
  // getSession only supplies a candidate token; verify that exact token remotely
  // before trusting its session claim. This retains one getUser verification.
  const session = await supabase.auth.getSession();
  if (session.error || !session.data.session) return { identity: { data: { user: null }, error: session.error }, secondFactorPending: false, pendingUser: undefined };
  return verifiedSessionState(supabase, session.data.session.access_token);
});
export const getSessionUser = cache(async () => (await getSessionState()).identity);

export const AUTH_UNAVAILABLE = "AUTH_UNAVAILABLE";
export const AUTH_UNAVAILABLE_MESSAGE = "We couldn't confirm your sign-in just now, so this wasn't saved. Try again in a moment.";

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
    const requestHeaders = await headers();
    if (requestHeaders.has("next-action")) throw new Error(TWO_STEP_REQUIRED_MESSAGE);
    redirect(twoStepChallengeHref(safeReturnPath(requestHeaders.get(RETURN_PATH_HEADER))));
  }
  const { data: { user }, error } = state.identity;

  if (options.adminDiagnostics && error && !providerAuthFailure(error)) throw error;
  // An Auth outage (network error, 5xx, unknown response) is not a sign-out. A Server Action that redirected here
  // would drop the user's change without a word, so it is refused with a retryable reason instead.
  if (error && !providerAuthFailure(error) && (await headers()).has("next-action"))
    throw new ActionError(AUTH_UNAVAILABLE_MESSAGE, AUTH_UNAVAILABLE);
  if (error || !user || !user.email || !isUvaEmail(user.email) || !user.email_confirmed_at) {
    if (options.adminDiagnostics) throw new AdminAccessError("ADMIN_AUTH_REQUIRED", "Sign-in required.");
    redirect("/"); // Redirect to login page
  }

  // Fetch the Prisma user to get global roles
  const existingUser = await prisma.user.findUnique({ where: { id: user.id } });
  // A disabled account (suspended, or an account-deletion tombstone) is never
  // rewritten from the provider: a surviving session must not restore its email.
  const prismaUser = cookieStore.has(PLATFORM_VIEW_COOKIE) || existingUser?.disabledAt || existingUser?.email === user.email ? existingUser : await prisma.user.upsert({
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
  if (!options.adminDiagnostics && ((await headers()).has("next-action") || mobileRequest()?.write)) {
    const { assertSiteWritable } = await import("@/utils/site-settings");
    await assertSiteWritable(prismaUser.id);
  }

  return { supabaseUser: user, user: prismaUser, impersonation: null };
}

/** The caller's graduation date, read at most once per request (React cache). */
const requestGraduation = cache((userId: string) => readGraduation(prisma)(userId));

/** Every sensitive club operation checks the current database membership. */
export async function requireClubPermission(clubId: string, permissions: ClubPermission[], options: { allowSuspendedRead?: boolean } = {}) {
  const { user } = await requireAuth();
  const found = await prisma.clubMember.findUnique({ where: { userId_clubId: { userId: user.id, clubId } } });
  if (!found || !isActiveMembership(found) || !permissions.every(permission => hasPermission(found, permission))) {
    throw new ActionError("You do not have permission for this club action.", "FORBIDDEN");
  }
  // A graduate kept as owner is read-only here except for handing the club over (lib/graduation.ts).
  const membership = await graduateMemberFor(prisma, found, permissions, requestGraduation);
  if (!options.allowSuspendedRead) await assertClubOperational(prisma, clubId);
  return { user, membership };
}
export async function requireClubMembership(clubId: string) {
  return requireClubPermission(clubId, []);
}
