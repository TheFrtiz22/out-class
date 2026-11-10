"use client"

import dynamic from "next/dynamic"
import { WorkspaceLoading } from "@/components/workspace-loading"
import { useAuth } from "@/contexts/auth-context"
import { LiveLeaderWorkspace } from "@/components/views/leader-dashboard/live-leader-workspace"

const LocalLeaderDashboardView = dynamic(
  () => import("@/components/views/leader-dashboard/local-leader-dashboard"),
  { loading: () => <WorkspaceLoading label="Loading local recruitment preview…" layout="applicants" /> },
)

export function LeaderDashboardView() {
  const { user, loading } = useAuth()
  if (loading) return <WorkspaceLoading label="Loading recruitment workspace…" layout="applicants" />
  if (user) return <LiveLeaderWorkspace />
  return <div className="space-y-5"><p className="border-b border-border pb-4 text-sm text-muted-foreground">Local preview · changes in these tools do not update real applicants.</p><LocalLeaderDashboardView /></div>
}
