import Link from "next/link"
import { getClubAccess } from "@/actions/club-access"
import { ClubAccessEditor } from "@/components/club-access-editor"
import { PageHeader } from "@/components/ui/page-header"
import { Panel } from "@/components/ui/panel"
import { SignInCard } from "@/components/landing/sign-in-card"
import { clubLinkPreview } from "@/lib/public-link-preview"
import { getSessionUser } from "@/utils/auth"

export const metadata = { title: "Workspace access", robots: { index: false, follow: false } }
export default async function AccessPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params
  const { data: { user } } = await getSessionUser()
  if (!user) {
    const next = `/club-access/${encodeURIComponent(clubId)}`
    const club = await clubLinkPreview(clubId)
    return club ? (
      <SignInCard eyebrow="Club workspace" title={<>Sign in to manage access for {club.name}</>} next={next} createAccount={false}>
        <p>Workspace access is managed by the club’s owners and admins. Sign in with your UVA account to continue.</p>
      </SignInCard>
    ) : (
      <SignInCard invalid title="This club link isn’t valid" next={next}><p>The club may have moved or is no longer listed.</p></SignInCard>
    )
  }
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
