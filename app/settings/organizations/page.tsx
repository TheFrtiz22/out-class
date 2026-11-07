import { redirect } from "next/navigation"
import { requireAuth } from "@/utils/auth"
import { requireCompletedStudentProfile } from "@/utils/profile-onboarding"

export const metadata = { title: "My Clubs" }

/**
 * Settings → Organizations repeated My Clubs; memberships, invitations and “Find or claim a club”
 * live there now. Invitation emails still link here, so the same sign-in and profile-completion
 * gate runs first (first-time members finish the profile wizard, which returns here), then the
 * page redirects with its parameters.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireAuth({ verifyEmail: true })
  await requireCompletedStudentProfile(user.id, "/settings/organizations")
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item)
  redirect(`/clubs${params.size ? `?${params}` : ""}`)
}
