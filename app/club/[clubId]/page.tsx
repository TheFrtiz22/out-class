import { canAccessDemo, DEMO_COOKIE } from "@/lib/demo/access"
import { redirect, notFound } from "next/navigation"
import { publicClubs } from "@/lib/public-clubs"
import { PublicClubPage } from "@/components/qr/public-club-page"
import { getPublicClub } from "@/actions/club-directory"
import { getSessionUser } from "@/utils/auth"
import { cookies } from "next/headers"
import type { Metadata } from "next"
import { getPublicClubSeo, isIndexableClub } from "@/lib/public-club-seo"
import { publicPageMetadata, privateRobots } from "@/lib/seo"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"

export async function generateMetadata({ params }: { params: Promise<{ clubId: string }> }): Promise<Metadata> {
  const { clubId } = await params
  const club = await getPublicClubSeo(clubId)
  if (!club || !isIndexableClub(club)) return { title: club?.name ?? "Club profile", robots: privateRobots }
  const jar = await cookies()
  const accountPage = jar.has(PLATFORM_VIEW_COOKIE) || jar.get(DEMO_COOKIE)?.value === "1" ||
    jar.getAll().some(cookie => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name))
  return {
    ...publicPageMetadata(`${club.name} | OutClass`, club.description.trim().replace(/\s+/g, " ").slice(0, 160), `/club/${encodeURIComponent(club.id)}`),
    ...(accountPage ? { robots: privateRobots } : {}),
  }
}
export default async function ClubPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params
  const jar = await cookies()
  if (jar.get(DEMO_COOKIE)?.value === "1") {
    const { data: { user }, error: authError } = await getSessionUser()
    if (canAccessDemo(authError || !user?.email_confirmed_at ? undefined : user.email)) redirect(`/preview?demoClub=${encodeURIComponent(clubId)}`)
  }
  const result = await getPublicClub(clubId)
  const sample = publicClubs.find((club) => club.id === clubId)
  const club = result.club || (sample ? { ...sample, source: "preview" as const } : null)
  if (!club) {
    if (result.error)
      return (
        <main className="mx-auto max-w-xl p-8">
          <h1 className="oc-page-title ">Club profile unavailable</h1>
          <p className="my-4">{result.error}</p>
          <a className="underline" href={`/club/${encodeURIComponent(clubId)}`}>
            Try again
          </a>
        </main>
      )
    notFound()
  }
  const {
    data: { user },
  } = await getSessionUser()
  return <PublicClubPage club={club} authenticated={!!user} />
}
