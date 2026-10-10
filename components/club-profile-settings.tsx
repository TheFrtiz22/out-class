"use client"
import { uploadClubAsset } from "@/actions/club-assets"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { demoStore } from "@/lib/demo/store"
import { hasPermission } from "@/lib/permissions"
import { updateClubSettings } from "@/actions/club-workspace"
import { ClubProfileEditor } from "@/components/clubs/club-profile-editor"
import { profileDraft } from "@/lib/club-marketing"

export function ClubProfileSettings({ clubId, onSaved }: { clubId: string; onSaved?: () => void }) {
  const { user, refreshUser } = useAuth(), demo = useDemoMode()
  const member = user?.memberships.find(m => m.clubId === clubId)
  const club = demo.isDemoEnabled ? demo.state?.clubs.find(c => c.id === clubId) : member?.club
  if (!club || !hasPermission(member, "club.settings")) return <p role="alert">Appearance is not available with your current access.</p>
  return <div className="oc-club-settings space-y-10">
    <ClubProfileEditor key={clubId} initial={profileDraft({ ...club, logoUrl: demo.isDemoEnabled && club.logoUrl?.startsWith("data:image/svg") ? null : club.logoUrl })} demo={demo.isDemoEnabled} onUpload={demo.isDemoEnabled ? undefined : async file => { const data = new FormData(); data.set("clubId", clubId); data.set("admin", "false"); data.set("file", file); return (await uploadClubAsset(data)).reference; }} onSave={async profile => {
      if (demo.isDemoEnabled) demoStore.mutate(state => {
        if (clubId !== state.clubs[0].id || state.perspective.role !== "leader") throw new Error("Demo management is limited to MII leaders.")
        Object.assign(state.clubs[0], profile)
      })
      else await updateClubSettings({ clubId, ...profile })
      try { await refreshUser() } catch { /* The saved profile is authoritative; keep the editor usable. */ }
      onSaved?.()
    }} />

  </div>
}
