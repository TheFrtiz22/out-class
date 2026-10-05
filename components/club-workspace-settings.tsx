"use client"
import { useAuth } from "@/contexts/auth-context"
import { ClubSettingsWorkspace } from "@/components/club-settings-workspace"
import { ClubMembers } from "@/components/club-members"
/** Legacy homepage entry uses the same persisted settings as the scoped workspace. */
export function ClubWorkspaceSettings({ section = "legacy" }: { section?: "legacy" | "members" | "settings" }) {
  const { activeClubId } = useAuth()
  if (!activeClubId) return <p>No club workspace assigned.</p>
  return section === "members" ? <ClubMembers clubId={activeClubId}/> : <ClubSettingsWorkspace clubId={activeClubId}/>
}
