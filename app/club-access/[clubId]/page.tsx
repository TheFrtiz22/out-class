import Link from "next/link"
import { getClubAccess } from "@/actions/club-access"
import { ClubAccessEditor } from "@/components/club-access-editor"
import { PageHeader } from "@/components/ui/page-header"
import { Panel } from "@/components/ui/panel"
export default async function AccessPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params
  const data = await getClubAccess(clubId)
  return (
    <Panel className="oc-workspace-stack max-w-[var(--oc-content-width)]">
      <Link href={`/club/${clubId}/workspace?section=members`} className="underline">
        Back to club members
      </Link>
      <PageHeader title="Workspace access" />
      <ClubAccessEditor clubId={clubId} initial={data} />
    </Panel>
  )
}
