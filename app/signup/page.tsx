import { SignupPageView } from "@/components/auth/signup-page-view"
import { getAuthEntryAccount } from "@/utils/auth-entry"
import { signupReturnPath, authenticationError } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const account = await getAuthEntryAccount()
  if (account?.disabled) return <main className="p-8">Your account is unavailable. Contact OutClass support.</main>
  const next = signupReturnPath(typeof params.next === "string" ? params.next : undefined)
  if (account?.hasProfile) redirect(next === "/" ? account.destination : next)
  return <SignupPageView initialUser={account?.user ?? null} initialError={authenticationError(params.error)} />
}
