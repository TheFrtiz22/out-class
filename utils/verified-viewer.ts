import "server-only"
import { cookies } from "next/headers"
import { DEMO_COOKIE } from "@/lib/demo/access"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { isUvaEmail } from "@/lib/auth"
import { prisma } from "@/utils/prisma"
import { getSessionUser } from "@/utils/auth"

export type VerifiedViewer = { state: "SIGNED_OUT" } | { state: "REFUSED" } | { state: "SKIPPED" } | { state: "VERIFIED"; userId: string }

/**
 * requireAuth's account gate (school email, confirmed email, enabled account) without redirecting
 * or throwing, for route-level preflights. Demo and support view-as sessions are SKIPPED: their
 * identity is resolved only by the real readers, never guessed here.
 */
export async function verifiedViewer(): Promise<VerifiedViewer> {
  const jar = await cookies()
  if (jar.get(DEMO_COOKIE)?.value === "1" || jar.has(PLATFORM_VIEW_COOKIE)) return { state: "SKIPPED" }
  const { data: { user }, error } = await getSessionUser()
  if (error || !user) return { state: "SIGNED_OUT" }
  if (!user.email || !isUvaEmail(user.email) || !user.email_confirmed_at) return { state: "REFUSED" }
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { disabledAt: true } })
  if (!account || account.disabledAt) return { state: "REFUSED" }
  return { state: "VERIFIED", userId: user.id }
}
