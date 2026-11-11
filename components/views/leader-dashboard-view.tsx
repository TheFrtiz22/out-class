"use client"

import { WorkspaceLoading } from "@/components/workspace-loading"
import { useAuth } from "@/contexts/auth-context"
import { LiveLeaderWorkspace } from "@/components/views/leader-dashboard/live-leader-workspace"

export function LeaderDashboardView() {
  const { user, loading } = useAuth()
  if (loading) return <WorkspaceLoading label="Loading recruitment workspace…" layout="applicants" />
  // The signed-out local preview is retired (FE-28); Demo Mode is the way to try the product.
  if (user) return <LiveLeaderWorkspace />
  return <p className="text-sm text-muted-foreground">Sign in to open your club workspace.</p>
}
