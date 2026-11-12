"use client"
import { UserFacingError } from "@/lib/action-result"
import { uploadClubAsset } from "@/actions/club-assets"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { loadedDemoStore } from "@/lib/demo/loader"
import { hasPermission } from "@/lib/permissions"
import { updateClubSettings } from "@/actions/club-workspace"
import { ClubProfileEditor } from "@/components/clubs/club-profile-editor"
import { useEffect, useState } from "react"
import { readWorkspace } from "@/lib/workspace-read"
import { clubProfileSchema, profileDraft } from "@/lib/club-marketing"

export function ClubProfileSettings({ clubId, onSaved }: { clubId: string; onSaved?: () => void }) {
  const { user, refreshUser } = useAuth(), demo = useDemoMode()
  const member = user?.memberships.find(m => m.clubId === clubId)
  const club = demo.isDemoEnabled ? demo.state?.clubs.find(c => c.id === clubId) : member?.club
  // The roster count is a suggestion beside "Active members"; it loads after the editor and never remounts it
  // (a remount would discard edits in progress).
  const canCount = !demo.isDemoEnabled && hasPermission(member, "members.manage")
  const [roster, setRoster] = useState<{ clubId: string; count: number | null } | null>(null)
  useEffect(() => {
    if (!canCount) return
    let current = true
    readWorkspace<{ members: { status: string }[] }>("members", [clubId]).then(value => { if (current) setRoster({ clubId, count: value.members.filter(m => m.status === "ACTIVE").length }) }).catch(() => { if (current) setRoster({ clubId, count: null }) })
    return () => { current = false }
  }, [canCount, clubId])
  const rosterCount = roster?.clubId === clubId ? roster.count : null
  if (!club || !hasPermission(member, "club.settings")) return <p role="alert">Settings are not available with your current access.</p>
  return <div className="oc-club-settings space-y-10">
    <ClubProfileEditor clubId={clubId} key={clubId} rosterCount={rosterCount} initial={profileDraft({ ...club, logoUrl: demo.isDemoEnabled && club.logoUrl?.startsWith("data:image/svg") ? null : club.logoUrl })} demo={demo.isDemoEnabled} onUpload={demo.isDemoEnabled ? undefined : async file => { const data = new FormData(); data.set("clubId", clubId); data.set("admin", "false"); data.set("file", file); return (await uploadClubAsset(data)).reference; }} onSave={async (profile, expected) => {
      if (demo.isDemoEnabled) loadedDemoStore().demoStore.mutate(state => {
        if (clubId !== state.clubs[0].id || state.perspective.role !== "leader") throw new UserFacingError("Demo management is limited to MII leaders.")
        Object.assign(state.clubs[0], profile)
      })
      else await updateClubSettings({ clubId, ...profile, expectedProfile: expected ? JSON.stringify(clubProfileSchema.parse(expected)) : undefined })
      try { await refreshUser() } catch { /* The saved profile is authoritative; keep the editor usable. */ }
      onSaved?.()
    }} />

  </div>
}
