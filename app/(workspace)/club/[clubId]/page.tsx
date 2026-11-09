import { AuthenticatedPageLayout } from "@/components/shell/authenticated-page-layout"
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
import { getClubShareProfile } from "@/lib/club-share-profile"
import { clubShareMetadata } from "@/lib/club-share-text"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { PageHeader } from "@/components/ui/page-header"
import { presentPublicMarketing } from "@/lib/public-club-content"
import { readMarketing } from "@/lib/club-marketing"

export async function generateMetadata({ params }: { params: Promise<{ clubId: string }> }): Promise<Metadata> {
  const { clubId } = await params
  const [club, share] = await Promise.all([getPublicClubSeo(clubId), getClubShareProfile(clubId)])
  // Shared links unfurl as the club's profile card whether or not the page is indexed.
  const preview = share ? clubShareMetadata(share) : {}
  if (!club || !isIndexableClub(club)) return { title: club?.name ?? "Club not found", robots: privateRobots, ...preview }
  const jar = await cookies()
  const accountPage = jar.has(PLATFORM_VIEW_COOKIE) || jar.get(DEMO_COOKIE)?.value === "1" ||
    jar.getAll().some(cookie => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name))
  return {
    ...publicPageMetadata(club.name, club.description.trim().replace(/\s+/g, " ").slice(0, 160), `/club/${encodeURIComponent(club.id)}`),
    ...preview,
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
  const found = result.club || (sample ? { ...sample, source: "preview" as const } : null)
  // The client receives the public view of the marketing JSON only: research notes,
  // source links and "not published" placeholders never reach the page or its payload.
  const club = found && { ...found, marketing: presentPublicMarketing(readMarketing(found.marketing)) }
  if (!club) {
    if (result.error)
      return (
        <AuthenticatedPageLayout optional><div className="mx-auto max-w-xl p-8">
          <PageHeader title="Club profile unavailable" />
          <p className="my-4">{result.error}</p>
          <a className="underline" href={`/club/${encodeURIComponent(clubId)}`}>
            Try again
          </a>
        </div></AuthenticatedPageLayout>
      )
    notFound()
  }
  const {
    data: { user },
  } = await getSessionUser()
  return <AuthenticatedPageLayout optional><PublicClubPage club={club} authenticated={!!user} embedded={!!user} /></AuthenticatedPageLayout>
}
