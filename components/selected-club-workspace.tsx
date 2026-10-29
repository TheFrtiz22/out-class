"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { recordWorkspaceRead } from "@/lib/workspace-read-diagnostics"
import { readWorkspace } from "@/lib/workspace-read"
import { Button } from "@/components/ui/button"
import { WorkspaceLoading } from "@/components/workspace-loading"

export type SelectedClubWorkspaceKind = "members" | "pipeline" | "tasks" | "announcements"

// Only the selected tab starts work. Code and its original guarded GET overlap;
// neither module loading nor a previous tab's data can authorize this visit.
export async function loadSelectedClubWorkspace(kind: SelectedClubWorkspaceKind, clubId: string) {
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
        readWorkspace<Awaited<ReturnType<typeof import("@/actions/crm").getClubPipeline>>>("pipeline", [clubId, { genderCounts: false }]),
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
  const { user, readAuthority, isReadAuthorityCurrent, isImpersonating, loading } = useAuth()
  const demo = useDemoMode()
  const [retry, setRetry] = useState(0)
  // Same full identity/session ownership as interview reads. This is a mounted
  // visit, not a cache: leaving or changing authority always starts a new GET.
  const mode = rejectedOnly ? "rejected" : decisionsOnly ? "decisions" : "applicants"
  const owner = useMemo(() => ({ user, readAuthority, isImpersonating, clubId, kind, privacyScope, retry, mode, demoReady: demo.ready, demoEnabled: demo.isDemoEnabled }), [user, readAuthority, isImpersonating, clubId, kind, privacyScope, retry, mode, demo.ready, demo.isDemoEnabled])
  const [result, setResult] = useState<{ owner: object; value?: Loaded; failed?: boolean } | null>(null)
  const lastRead = useRef<typeof owner | null>(null)
  useEffect(() => {
    if (!demo.ready || demo.isDemoEnabled || loading || !user || !isReadAuthorityCurrent(readAuthority)) return
    recordWorkspaceRead("selected", lastRead.current ? (Object.keys(owner) as (keyof typeof owner)[]).filter(key => lastRead.current![key] !== owner[key]) : ["mount"])
    lastRead.current = owner
    let current = true
    void loadSelectedClubWorkspace(kind, clubId).then(value => {
      if (current && isReadAuthorityCurrent(readAuthority)) setResult({ owner, value })
    }).catch(() => { if (current && isReadAuthorityCurrent(readAuthority)) setResult({ owner, failed: true }) })
    return () => { current = false }
  }, [kind, clubId, mode, owner, demo.ready, demo.isDemoEnabled, loading, user, readAuthority, isReadAuthorityCurrent])
  const current = demo.ready && !demo.isDemoEnabled && !loading && isReadAuthorityCurrent(readAuthority) && result?.owner === owner ? result : null
  if (current?.failed) return <div role="alert" className="space-y-3"><p>Could not load this workspace. Your access may have changed.</p><Button variant="outline" onClick={() => setRetry(value => value + 1)}>Retry workspace</Button></div>
  const entry = current?.value
  if (!entry) return <WorkspaceLoading label={kind === "pipeline" ? "Preparing your applicant pipeline…" : kind === "members" ? "Loading club members…" : kind === "tasks" ? "Loading club tasks…" : "Loading announcements…"} layout={kind === "pipeline" ? "applicants" : kind === "announcements" ? "feed" : kind === "members" ? "table" : "rows"} rows={kind === "pipeline" ? 5 : 3} />
  switch (entry.kind) {
    case "members": { const View = entry.module.ClubMembers; return <View clubId={clubId} initialDirectory={entry.data} validatedInitialData /> }
    case "pipeline": { const View = entry.module.LiveLeaderWorkspace; return <View scoped decisionsOnly={decisionsOnly} rejectedOnly={rejectedOnly} initialData={{ clubId, pipeline: entry.data }} validatedInitialData /> }
    case "tasks": { const View = entry.module.ClubTasks; return <View clubId={clubId} embedded personalOnly={personalOnly} initialScope={initialScope} initialData={entry.data} /> }
    case "announcements": { const View = entry.module.ClubAnnouncements; return <View clubId={clubId} initialItems={entry.data} /> }
  }
}
