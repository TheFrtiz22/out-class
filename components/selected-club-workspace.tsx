"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { readWorkspace } from "@/lib/workspace-read"
import { Button } from "@/components/ui/button"

export type SelectedClubWorkspaceKind = "members" | "pipeline" | "tasks" | "announcements"

// Only the selected tab starts work. Code and its original guarded GET overlap;
// neither module loading nor a previous tab's data can authorize this visit.
export async function loadSelectedClubWorkspace(kind: SelectedClubWorkspaceKind, clubId: string, mode: "applicants" | "decisions" | "rejected" = "applicants") {
  switch (kind) {
    case "members": {
      const [module, data] = await Promise.all([
        import("@/components/club-members"),
        readWorkspace<Awaited<ReturnType<typeof import("@/actions/organization-members").getOrganizationMemberManagement>>>("members", [clubId]),
      ])
      return { kind, module, data } as const
    }
    case "pipeline": {
      const [module, data] = await Promise.all([
        import("@/components/views/leader-dashboard/live-leader-workspace"),
        readWorkspace<Awaited<ReturnType<typeof import("@/actions/crm").getClubPipelineList>>>("pipelineList", [clubId, { genderCounts: false }]),
      ])
      return { kind, module, data } as const
    }
    case "tasks": {
      const [module, data] = await Promise.all([
        import("@/components/club-tasks"),
        readWorkspace<Awaited<ReturnType<typeof import("@/actions/tasks").getTaskWorkspace>>>("tasks", [clubId]),
      ])
      return { kind, module, data } as const
    }
    case "announcements": {
      const [module, data] = await Promise.all([
        import("@/components/club-announcements"),
        readWorkspace<Awaited<ReturnType<typeof import("@/actions/communications").getClubAnnouncements>>>("announcements", [clubId]),
      ])
      return { kind, module, data } as const
    }
  }
}

type Loaded = Awaited<ReturnType<typeof loadSelectedClubWorkspace>>
export function SelectedClubWorkspace({ kind, clubId, privacyScope, personalOnly, initialScope, decisionsOnly, rejectedOnly }: {
  kind: SelectedClubWorkspaceKind; clubId: string; privacyScope: string;
  personalOnly?: boolean; initialScope?: string; decisionsOnly?: boolean; rejectedOnly?: boolean;
}) {
  const { user, readAuthority, isImpersonating, loading } = useAuth()
  const demo = useDemoMode()
  const [retry, setRetry] = useState(0)
  // Same full identity/session ownership as interview reads. This is a mounted
  // visit, not a cache: leaving or changing authority always starts a new GET.
  const mode = rejectedOnly ? "rejected" : decisionsOnly ? "decisions" : "applicants"
  const owner = useMemo(() => ({ user, readAuthority, isImpersonating, clubId, kind, privacyScope, retry, mode, demoReady: demo.ready, demoEnabled: demo.isDemoEnabled }), [user, readAuthority, isImpersonating, clubId, kind, privacyScope, retry, mode, demo.ready, demo.isDemoEnabled])
  const [result, setResult] = useState<{ owner: object; value?: Loaded; failed?: boolean } | null>(null)
  useEffect(() => {
    if (!demo.ready || demo.isDemoEnabled || loading || !user) return
    let current = true
    void loadSelectedClubWorkspace(kind, clubId, mode).then(value => {
      if (current) setResult({ owner, value })
    }).catch(() => { if (current) setResult({ owner, failed: true }) })
    return () => { current = false }
  }, [kind, clubId, mode, owner, demo.ready, demo.isDemoEnabled, loading, user])
  const current = demo.ready && !demo.isDemoEnabled && !loading && result?.owner === owner ? result : null
  if (current?.failed) return <div role="alert" className="space-y-3"><p>Could not load this workspace. Your access may have changed.</p><Button variant="outline" onClick={() => setRetry(value => value + 1)}>Retry workspace</Button></div>
  const entry = current?.value
  if (!entry) return <p role="status">Loading workspace…</p>
  switch (entry.kind) {
    case "members": { const View = entry.module.ClubMembers; return <View clubId={clubId} initialDirectory={entry.data} validatedInitialData /> }
    case "pipeline": { const View = entry.module.LiveLeaderWorkspace; return <View scoped decisionsOnly={decisionsOnly} rejectedOnly={rejectedOnly} initialData={{ clubId, pipeline: entry.data }} validatedInitialData /> }
    case "tasks": { const View = entry.module.ClubTasks; return <View clubId={clubId} embedded personalOnly={personalOnly} initialScope={initialScope} initialData={entry.data} /> }
    case "announcements": { const View = entry.module.ClubAnnouncements; return <View clubId={clubId} initialItems={entry.data} /> }
  }
}
