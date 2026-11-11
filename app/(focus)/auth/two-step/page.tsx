import { notFound, redirect } from "next/navigation"
import { signInReturnPath } from "@/lib/auth"
import { userMfaEnabled } from "@/lib/user-mfa"
import { getSessionState } from "@/utils/auth"
import { TwoStepChallenge } from "@/components/security/two-step-challenge"

export const metadata = { title: "Two-step sign-in", robots: { index: false, follow: false } }

export default async function TwoStepPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!userMfaEnabled()) notFound()
  const params = await searchParams
  const next = signInReturnPath(typeof params.next === "string" ? params.next : undefined)
  const state = await getSessionState()
  if (!state.secondFactorPending) redirect(state.identity.data.user ? next : "/login")
  return <TwoStepChallenge next={next} />
}
