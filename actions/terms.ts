"use server"

import { cookies } from "next/headers"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { DEMO_COOKIE } from "@/lib/demo/access"
import { checkClickwrap, TERMS_ACCEPTANCE_REQUIRED } from "@/lib/legal-versions"
import { requireAuth } from "@/utils/auth"
import { prisma } from "@/utils/prisma"
import { recordTermsAcceptance } from "@/utils/terms-acceptance"

/**
 * The signed-in account holder accepts the current Terms and Privacy Policy: during sign-up, before
 * a student profile exists (source SIGNUP), or on the one-time screen afterwards (PROMPT).
 * A support (view-as) session can never accept for the user, and Demo Mode never writes.
 */
export async function acceptCurrentTerms(input: unknown) {
  const jar = await cookies()
  if (jar.has(PLATFORM_VIEW_COOKIE)) return { error: "Only the account holder can accept the Terms. Exit impersonation first." }
  if (jar.get(DEMO_COOKIE)?.value === "1") return { error: "Exit Demo Mode to accept the Terms." }
  if (!TERMS_ACCEPTANCE_REQUIRED) return { accepted: true }
  const check = checkClickwrap(input)
  if (!check.ok) return { error: check.error }
  const { user, impersonation } = await requireAuth()
  if (impersonation) return { error: "Only the account holder can accept the Terms. Exit impersonation first." }
  // The source is derived here, never taken from the client: before the profile exists this is the
  // sign-up flow; afterwards it is the one-time screen.
  const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id }, select: { id: true } })
  await recordTermsAcceptance(prisma, user.id, profile ? "PROMPT" : "SIGNUP")
  return { accepted: true }
}
