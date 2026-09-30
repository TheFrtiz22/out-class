"use client"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { demoStore } from "@/lib/demo/store"
import { hasPermission } from "@/lib/permissions"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { updateClubSettings } from "@/actions/club-workspace"
import { ClubProfileEditor } from "@/components/clubs/club-profile-editor"
import { profileDraft } from "@/lib/club-marketing"

export function ClubProfileSettings({ clubId, onSaved }: { clubId: string; onSaved?: () => void }) {
  const { user, refreshUser } = useAuth(), demo = useDemoMode()
  const member = user?.memberships.find(m => m.clubId === clubId)
  const club = demo.isDemoEnabled ? demo.state?.clubs.find(c => c.id === clubId) : member?.club
  if (!club || !hasPermission(member, "club.settings")) return <p role="alert">Club settings are not available with your current access.</p>
  const root = `/club/${encodeURIComponent(clubId)}/workspace`
  const links = [
    ...(hasPermission(member,"members.manage") || hasPermission(member,"leaders.manage") ? [{title:"Members & management access",detail:"Membership, invitations, and granular club capabilities.",href:`${root}?section=members`,group:"Access"}] : []),
    ...(hasPermission(member,"recruitment.manage") ? [{title:"Review privacy & test requirements",detail:"Round-level anonymous review and required tests for future applications.",href:`${root}?section=recruitment&tool=rounds`,group:"Recruiting"}] : []),
    ...(hasPermission(member,"interviews.manage") ? [{title:"Interview kits & settings",detail:"Manage round questions and guidance in the recruiting workspace.",href:`${root}?section=recruitment&tool=interviews`,group:"Recruiting"}] : []),
  ]
  return <div className="space-y-10">
    <ClubProfileEditor key={clubId} initial={profileDraft({ ...club, logoUrl: demo.isDemoEnabled && club.logoUrl?.startsWith("data:image/svg") ? null : club.logoUrl })} demo={demo.isDemoEnabled} onSave={async profile => {
      if (demo.isDemoEnabled) demoStore.mutate(state => {
        if (clubId !== state.clubs[0].id || state.perspective.role !== "leader") throw new Error("Demo management is limited to MII leaders.")
        Object.assign(state.clubs[0], profile)
      })
      else await updateClubSettings({ clubId, ...profile })
      onSaved?.()
      try { await refreshUser() } catch { /* The saved profile is authoritative; keep the editor usable. */ }
    }} />
    {links.length > 0 && <section aria-labelledby="related-club-settings" className="border-t pt-7"><h2 id="related-club-settings" className="font-display text-2xl">Other club settings</h2><ul className="mt-4 divide-y">{links.map(link => <li key={link.href}><Link href={link.href} onClick={event => { if (!canLeaveWorkspace()) event.preventDefault() }} className="block rounded py-5 focus-visible:outline-2 focus-visible:outline-ring"><p className="text-xs text-muted-foreground">{link.group}</p><h3 className="mt-1 text-sm font-medium">{link.title} →</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{link.detail}</p></Link></li>)}</ul></section>}

  </div>
}
