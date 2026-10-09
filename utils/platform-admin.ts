import { AdminAccessError, providerAuthFailure } from "@/lib/admin-failure"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { requireAuth } from "@/utils/auth"
import { prisma } from "@/utils/prisma"
import { createClient } from "@/utils/supabase/server"
import { requireAdminElevation } from "@/utils/admin-elevation"
import { cookies } from "next/headers"

/** Independent of profile fields, global legacy roles, club ownership, and demo roles. */
export async function requirePlatformAdminEligibility() {
  const { user } = await requireAuth({ allowPlatformView: true, adminDiagnostics: true })
  const allowed = (process.env.OUTCLASS_PLATFORM_ADMIN_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
  if (!allowed.includes(user.id)) throw new AdminAccessError("ADMIN_ACCESS_DENIED", "Platform administrator access denied.")
  const grant = await prisma.platformAdmin.findUnique({ where: { userId: user.id } })
  if (!grant?.active) throw new AdminAccessError("ADMIN_GRANT_REVOKED", "Platform administrator access denied.")
  return user
}

export async function requirePlatformAdmin(options: { allowViewAs?: boolean } = {}) {
  const user = await requirePlatformAdminEligibility()
  const client = await createClient(await cookies())
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error && !providerAuthFailure(error)) throw error
  if (error || data?.currentLevel !== "aal2")
    throw new AdminAccessError("ADMIN_MFA_REQUIRED", "Verify your authenticator to enter platform administration.")
  if (!options.allowViewAs && (await cookies()).has(PLATFORM_VIEW_COOKIE)) throw new AdminAccessError("ADMIN_SUPPORT_SESSION_CONFLICT", "Exit impersonation before performing administrator operations.")
  await requireAdminElevation(user.id)
  return user
}
