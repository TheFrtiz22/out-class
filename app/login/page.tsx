import { LoginPageView } from "@/components/auth/login-page-view"
import { AccountUnavailable } from "@/components/auth/account-unavailable"
import { getAuthEntryAccount } from "@/utils/auth-entry"
import { safeReturnPath, authEntryHref, authenticationError } from "@/lib/auth"
import { redirect } from "next/navigation"
import { returnClub } from "@/lib/auth-club-context"
import { getPublicClubSeo } from "@/lib/public-club-seo"

export const metadata = { title: "Sign in", robots: { index: false, follow: false } }

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const account = await getAuthEntryAccount()
  if (account?.disabled) return <AccountUnavailable />
  if (account) {
    const next = safeReturnPath(typeof params.next === "string" ? params.next : undefined)
    // Deliberate platform entry retains its independent authorization and MFA checks.
    if (next === "/platform" || next.startsWith("/platform/")) redirect(next)
    if (!account.hasProfile) {
      const query = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) value.forEach(item => query.append(key, item))
        else if (value !== undefined) query.set(key, value)
      })
      redirect(authEntryHref("/signup", query.toString()))
    }
    redirect(next === "/" || next === "/login" ? account.destination : next)
  }
  const target = returnClub(safeReturnPath(typeof params.next === "string" ? params.next : undefined))
  const club = target ? await getPublicClubSeo(target.ref) : null
  return <LoginPageView initialError={authenticationError(params.error)} club={club && target ? { name: club.name, follow: target.follow } : undefined} />
}
