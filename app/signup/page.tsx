import { SignupPageView } from "@/components/auth/signup-page-view"
import { AccountUnavailable } from "@/components/auth/account-unavailable"
import { getAuthEntryAccount } from "@/utils/auth-entry"
import { signupReturnPath, authenticationError } from "@/lib/auth"
import { redirect } from "next/navigation"
import { TERMS_ACCEPTANCE_REQUIRED } from "@/lib/legal-versions"
import { hasCurrentTermsAcceptance } from "@/utils/terms-acceptance"
import { prisma } from "@/utils/prisma"

export const metadata = { title: "Create your profile", robots: { index: false, follow: false } }

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const account = await getAuthEntryAccount()
  if (account?.disabled) return <AccountUnavailable />
  const next = signupReturnPath(typeof params.next === "string" ? params.next : undefined)
  if (account?.hasProfile) redirect(next === "/" ? account.destination : next)
  // A signed-in account finishing its profile (Microsoft, confirmed link) is asked once, unless it already accepted.
  const termsAccepted = !!account?.user && TERMS_ACCEPTANCE_REQUIRED && await hasCurrentTermsAcceptance(prisma, account.user.id).catch(() => false)
  return <SignupPageView initialUser={account?.user ?? null} initialError={authenticationError(params.error)} termsAccepted={termsAccepted} />
}
