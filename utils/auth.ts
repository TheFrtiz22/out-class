import { createClient as createAdminClient, type User as AuthUser } from "@supabase/supabase-js";
import { platformViewSession } from "@/utils/platform-view-as";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
import { hasPermission, isActiveMembership, type ClubPermission } from "@/lib/permissions";
import { DEMO_COOKIE } from "@/lib/demo/access";
import { isUvaEmail } from "@/lib/auth";
import { createClient } from "./supabase/server";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { redirect } from "next/navigation";

/**
 * Ensures a user is logged in. Returns the Supabase user and Prisma user.
 * Redirects to /auth (or home) if not authenticated.
 */
export async function requireAuth(options: { allowPlatformView?: boolean; verifyEmail?: boolean } = {}) {
  const cookieStore = await cookies();
  if (cookieStore.has(PLATFORM_VIEW_COOKIE) && !options.allowPlatformView) {
    const session = await platformViewSession();
    if (!session) throw new Error("Impersonation expired or unavailable. Exit impersonation to continue.");
    const effective = await prisma.user.findUnique({ where: { id: session.targetUserId } });
    if (!effective || effective.disabledAt) throw new Error("This account is unavailable.");
    // Only operations which need provider verification fetch the target's Auth record.
    // No target tokens are created or returned, and the original login is never changed.
    if (options.verifyEmail) {
      const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!secret) throw new Error("Target email verification is unavailable.");
      const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", secret, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await admin.auth.admin.getUserById(effective.id);
      if (error || !data.user || data.user.id !== effective.id || data.user.email?.toLowerCase() !== effective.email.toLowerCase()) throw new Error("Target email verification is unavailable.");
      const supabaseUser: Pick<AuthUser, "id" | "email" | "email_confirmed_at" | "confirmation_sent_at" | "app_metadata" | "identities"> = { id: effective.id, email: effective.email, email_confirmed_at: data.user.email_confirmed_at, confirmation_sent_at: data.user.confirmation_sent_at, app_metadata: data.user.app_metadata, identities: data.user.identities };
      return { user: effective, supabaseUser, impersonation: session };
    }
    // Never borrow the administrator's Auth metadata or verified-email status.
    return { user: effective, supabaseUser: { id: effective.id, email: effective.email, email_confirmed_at: undefined, app_metadata: {} }, impersonation: session };
  }
  if (cookieStore.get(DEMO_COOKIE)?.value === "1") throw new Error("Live data is unavailable in Demo Mode.");
  const supabase = await createClient(cookieStore);
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user || !user.email || !isUvaEmail(user.email) || !user.email_confirmed_at) {
    redirect("/"); // Redirect to login page
  }

  // Fetch the Prisma user to get global roles
  const prismaUser = cookieStore.has(PLATFORM_VIEW_COOKIE) ? await prisma.user.findUnique({ where: { id: user.id } }) : await prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email },
    create: { id: user.id, email: user.email!, role: "STUDENT" },
  });

  if (!prismaUser || prismaUser.disabledAt) {
    // Edge case: Trigger failed or user was deleted from Prisma but not Supabase
    redirect("/");
  }

  return { supabaseUser: user, user: prismaUser, impersonation: null };
}

/** Every sensitive club operation checks the current database membership. */
export async function requireClubPermission(clubId: string, permissions: ClubPermission[]) {
  const { user } = await requireAuth();
  const membership = await prisma.clubMember.findUnique({ where: { userId_clubId: { userId: user.id, clubId } } });
  if (!membership || !isActiveMembership(membership) || !permissions.every(permission => hasPermission(membership, permission))) {
    throw new Error("You do not have permission for this club action.");
  }
  return { user, membership };
}
export async function requireClubMembership(clubId: string) {
  return requireClubPermission(clubId, []);
}
