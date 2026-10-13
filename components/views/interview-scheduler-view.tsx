"use client"

import { useAuth } from "@/contexts/auth-context"
import { hasPermission } from "@/lib/permissions"
import type { ViewId } from "@/lib/views"
import { InterviewManagementTabs } from "@/components/interview-management-tabs"

/** The legacy entry uses the production rooms/bookings and availability tools. */
export function InterviewSchedulerView({ onNavigate: _onNavigate }: { onNavigate: (view: ViewId) => void }) {
  const { user, activeClubId, loading } = useAuth()
  if (loading) return <p role="status">Loading interview workspace…</p>
  const member = user?.memberships.find(m => m.clubId === activeClubId)
  if (!activeClubId || !hasPermission(member, "interviews.manage")) return <p className="text-sm text-muted-foreground">Choose a club where you manage interview scheduling.</p>
  return <InterviewManagementTabs key={activeClubId} clubId={activeClubId} initialTab="schedule" />
}
