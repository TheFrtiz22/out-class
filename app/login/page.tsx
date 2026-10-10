import { LoginPageView } from "@/components/auth/login-page-view"
import { getAuthEntryAccount } from "@/utils/auth-entry"
import { safeReturnPath, authEntryHref, authenticationError } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const account = await getAuthEntryAccount()
  if (account?.disabled) return <main className="p-8">Your account is unavailable. Contact OutClass support.</main>
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
  return <LoginPageView initialError={authenticationError(params.error)} />
}
