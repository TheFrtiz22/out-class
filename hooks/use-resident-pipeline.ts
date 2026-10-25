"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getClubPipelineList } from "@/lib/workspace-api"
import { serializedWorkspaceRead } from "@/lib/serialized-workspace-read"

type Summary = Awaited<ReturnType<typeof getClubPipelineList>>
type Filter = Pick<NonNullable<Parameters<typeof getClubPipelineList>[1]>, "roundId" | "gender" | "genderCounts">

/** Already released summaries belong to one mounted authority/scope. No data or
 * successful authorization survives a visit, owner change or explicit refresh. */
export function useResidentPipeline({ clubId, filter, revision, authority, enabled, initialData, validatedInitialData }: {
  clubId: string; filter: Filter; revision: number; authority: object; enabled: boolean;
  initialData: Summary | null; validatedInitialData: boolean;
}) {
  const scope = JSON.stringify(filter)
  const owner = useMemo(() => ({ clubId, scope, revision, authority, enabled }), [clubId, scope, revision, authority, enabled])
  const [result, setResult] = useState<{ owner: object; data: Summary | null; failed: boolean } | null>(
    enabled && validatedInitialData && initialData ? { owner, data: initialData, failed: false } : null,
  )
  const latest = useRef({ owner, clubId, filter }), accepted = useRef(result)
  latest.current = { owner, clubId, filter }; accepted.current = result
  const reader = useRef<ReturnType<typeof serializedWorkspaceRead> | null>(null)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    const instance = serializedWorkspaceRead(async () => {
      const request = latest.current
      if (!request.owner.enabled) return { owner: request.owner, data: null, failed: false }
      try { return { owner: request.owner, data: await getClubPipelineList(request.clubId, request.filter), failed: false } }
      catch { return { owner: request.owner, data: null, failed: true } }
    }, value => {
      if (mounted.current && latest.current.owner === value.owner) setResult(value)
    }, () => {})
    reader.current = instance
    return () => { mounted.current = false; instance.dispose(); if (reader.current === instance) reader.current = null }
  }, [])
  useEffect(() => {
    if (!enabled || accepted.current?.owner === owner) return
    void reader.current?.refresh()
  }, [owner, enabled])
  // Async mutation/read completions retain their captured owner. They cannot
  // replace a newer account, club, privacy, server-filter or refresh result.
  const isCurrent = useCallback(() => mounted.current && latest.current.owner === owner, [owner])
  const setData = useCallback((value: Summary | null | ((previous: Summary | null) => Summary | null)) => {
    if (!mounted.current || latest.current.owner !== owner) return false
    setResult(previous => mounted.current && latest.current.owner === owner ? { owner, failed: false,
      data: typeof value === "function" ? value(previous?.owner === owner ? previous.data : null) : value } : previous)
    return true
  }, [owner])
  const current = enabled && result?.owner === owner ? result : null
  return { data: current?.data ?? null, loading: !current, error: current?.failed ?? false, setData, isCurrent }
}
