import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
import { hasPermission, type ClubPermission } from "@/lib/permissions";
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
export async function requireAuth(options: { allowPlatformView?: boolean } = {}) {
  const cookieStore = await cookies();
  if (cookieStore.has(PLATFORM_VIEW_COOKIE) && !options.allowPlatformView) throw new Error("Exit read-only administrator view before using normal account actions.");
  if (cookieStore.get(DEMO_COOKIE)?.value === "1") throw new Error("Live data is unavailable in Demo Mode.");
  const supabase = await createClient(cookieStore);
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user || !user.email || !isUvaEmail(user.email)) {
    redirect("/"); // Redirect to login page
  }

  // Fetch the Prisma user to get global roles
  const prismaUser = await prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email },
    create: { id: user.id, email: user.email!, role: "STUDENT" },
  });

  if (!prismaUser || prismaUser.disabledAt) {
    // Edge case: Trigger failed or user was deleted from Prisma but not Supabase
    redirect("/");
  }

  return { supabaseUser: user, user: prismaUser };
}

/** Every sensitive club operation checks the current database membership. */
export async function requireClubPermission(clubId: string, permissions: ClubPermission[]) {
  const { user } = await requireAuth();
  const membership = await prisma.clubMember.findUnique({ where: { userId_clubId: { userId: user.id, clubId } } });
  if (!membership || !permissions.every(permission => hasPermission(membership, permission))) {
    throw new Error("You do not have permission for this club action.");
  }
  return { user, membership };
}
export async function requireClubMembership(clubId: string) {
  return requireClubPermission(clubId, []);
}
