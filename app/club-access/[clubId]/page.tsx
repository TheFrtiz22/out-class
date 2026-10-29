import Link from "next/link"
import { getClubAccess } from "@/actions/club-access"
import { ClubAccessEditor } from "@/components/club-access-editor"
export default async function AccessPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params
  const data = await getClubAccess(clubId)
  return (
    <div className="oc-content-panel oc-workspace-stack max-w-4xl">
      <Link href={`/club/${clubId}/workspace?section=members`} className="underline">
        Back to club members
      </Link>
      <h1 className="oc-page-title ">Workspace access</h1>
      <ClubAccessEditor clubId={clubId} initial={data} />
    </div>
  )
}
