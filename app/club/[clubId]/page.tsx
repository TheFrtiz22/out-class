import { notFound } from "next/navigation"
import { publicClubs } from "@/lib/public-clubs"
import { PublicClubPage } from "@/components/qr/public-club-page"
import { getPublicClub } from "@/actions/club-directory"
import { getStudentDashboardData } from "@/actions/applications"
import { createClient } from "@/utils/supabase/server"
import { cookies } from "next/headers"
export default async function ClubPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params
  const result = await getPublicClub(clubId)
  const sample = publicClubs.find((club) => club.id === clubId)
  const club = result.club || (sample ? { ...sample, source: "preview" as const } : null)
  if (!club) {
    if (result.error)
      return (
        <main className="mx-auto max-w-xl p-8">
          <h1 className="text-xl font-semibold">Club profile unavailable</h1>
          <p className="my-4">{result.error}</p>
          <a className="underline" href={`/club/${encodeURIComponent(clubId)}`}>
            Try again
          </a>
        </main>
      )
    notFound()
  }
  const supabase = await createClient(await cookies())
  const {
    data: { user },
  } = await supabase.auth.getUser()
  let initialData = null
  if (user) {
    try {
      initialData = await getStudentDashboardData()
    } catch {
      /* The profile remains readable when private application data is unavailable. */
    }
  }
  return <PublicClubPage club={club} initialData={initialData} authenticated={!!user} />
}
