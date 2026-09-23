import { isUvaEmail } from "@/lib/auth";
import { createClient } from "./supabase/server";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { redirect } from "next/navigation";

/**
 * Ensures a user is logged in. Returns the Supabase user and Prisma user.
 * Redirects to /auth (or home) if not authenticated.
 */
export async function requireAuth() {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user || !user.email || !isUvaEmail(user.email)) {
    redirect("/"); // Redirect to login page
  }

  // Fetch the Prisma user to get global roles
  const prismaUser = await prisma.user.upsert({
    where: { id: user.id },
    update: {},
    create: { id: user.id, email: user.email!, role: "STUDENT" },
  });

  if (!prismaUser) {
    // Edge case: Trigger failed or user was deleted from Prisma but not Supabase
    redirect("/");
  }

  return { supabaseUser: user, user: prismaUser };
}

/**
 * Ensures a user has a specific role (or higher) in a given club.
 */
export async function requireClubRole(clubId: string, allowedRoles: ("PRESIDENT" | "RECRUITMENT_LEAD" | "GENERAL_MEMBER")[]) {
  const { user } = await requireAuth();

  const membership = await prisma.clubMember.findUnique({
    where: {
      userId_clubId: {
        userId: user.id,
        clubId: clubId,
      }
    }
  });

  if (!membership || !allowedRoles.includes(membership.role)) {
    redirect("/"); // Redirect unauthorized access to standard dashboard
  }

  return { user, membership };
}

