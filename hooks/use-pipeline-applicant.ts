"use client"

import { useEffect, useMemo, useState } from "react"
import { inFlightWorkspaceRead } from "@/lib/in-flight-workspace-read"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { getClubPipeline } from "@/lib/workspace-api"

type Pipeline = Awaited<ReturnType<typeof getClubPipeline>>

/** A fresh, single-applicant read per opening; late or previous-authority results stay hidden. */
export function usePipelineApplicant(clubId: string, applicationId: string | null, revision: number) {
  const { user, readAuthority, isReadAuthorityCurrent, isImpersonating, loading } = useAuth()
  const demo = useDemoMode()
  const [retry, setRetry] = useState(0)
  const owner = useMemo(() => ({ clubId, applicationId, revision, retry, user, readAuthority, isImpersonating, loading, demoReady: demo.ready, demoEnabled: demo.isDemoEnabled }), [clubId, applicationId, revision, retry, user, readAuthority, isImpersonating, loading, demo.ready, demo.isDemoEnabled])
  const [result, setResult] = useState<{ owner: object; pipeline: Pipeline | null; error: boolean } | null>(null)
  useEffect(() => {
    if (!applicationId || !demo.ready || loading || !user || !isReadAuthorityCurrent(readAuthority)) return
    let current = true
    inFlightWorkspaceRead(owner, "pipeline", [clubId, { applicationId }], () => getClubPipeline(clubId, { applicationId })).then(data => {
      if (current && isReadAuthorityCurrent(readAuthority)) setResult({ owner, pipeline: data, error: !data.applications.some(app => app.id === applicationId) })
    }).catch(() => { if (current && isReadAuthorityCurrent(readAuthority)) setResult({ owner, pipeline: null, error: true }) })
    return () => { current = false }
  }, [owner, clubId, applicationId, demo.ready, loading, user, readAuthority, isReadAuthorityCurrent])
  const current = demo.ready && !loading && !!user && isReadAuthorityCurrent(readAuthority) && result?.owner === owner ? result : null
  return { pipeline: current?.pipeline ?? null, application: current?.pipeline?.applications.find(app => app.id === applicationId) ?? null, error: current?.error ?? false, retry: () => setRetry(value => value + 1) }
}
