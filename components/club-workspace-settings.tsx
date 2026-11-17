"use client"
import { useAuth } from "@/contexts/auth-context"
import { ClubSettingsWorkspace } from "@/components/club-settings-workspace"
import { ClubMembers } from "@/components/club-members"
import { EmptyState } from "@/components/ui/empty-state"
/** Legacy homepage entry uses the same persisted settings as the scoped workspace. */
export function ClubWorkspaceSettings({ section = "legacy" }: { section?: "legacy" | "members" | "settings" }) {
  const { activeClubId } = useAuth()
  if (!activeClubId) return <EmptyState density="compact" align="start" tone="outlined" title="No club workspace yet" description="Join or claim a club in My Clubs to manage its members and settings here." />
  return section === "members" ? <ClubMembers clubId={activeClubId}/> : <ClubSettingsWorkspace clubId={activeClubId}/>
}
