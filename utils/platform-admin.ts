import { requireAuth } from "@/utils/auth"
import { prisma } from "@/utils/prisma"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"

/** Independent of profile fields, global legacy roles, club ownership, and demo roles. */
export async function requirePlatformAdmin() {
  const { user } = await requireAuth()
  const allowed = (process.env.OUTCLASS_PLATFORM_ADMIN_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
  if (!allowed.includes(user.id)) throw new Error("Platform administrator access denied.")
  const grant = await prisma.platformAdmin.findUnique({ where: { userId: user.id } })
  if (!grant?.active) throw new Error("Platform administrator access denied.")
  const client = await createClient(await cookies())
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error || data?.currentLevel !== "aal2")
    throw new Error("Verify your authenticator to enter platform administration.")
  return user
}
