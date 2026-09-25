import { getClubAccess } from "@/actions/club-access"
import { ClubAccessEditor } from "@/components/club-access-editor"
export default async function AccessPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params
  const data = await getClubAccess(clubId)
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <a href={`/club/${clubId}/workspace?section=members`} className="underline">
        Back to club members
      </a>
      <h1 className="font-display text-3xl">Workspace access</h1>
      <ClubAccessEditor clubId={clubId} initial={data} />
    </main>
  )
}
