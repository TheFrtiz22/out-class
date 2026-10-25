"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getClubPipelinePage } from "@/lib/workspace-api"
import { pipelinePageQuery, type PipelinePageQuery } from "@/lib/pipeline-page"
import { recordWorkspaceRead } from "@/lib/workspace-read-diagnostics"
import { serializedWorkspaceRead } from "@/lib/serialized-workspace-read"

type Page = Awaited<ReturnType<typeof getClubPipelinePage>>
type Context = { clubId: string; authority: object; revision: number; enabled: boolean }
type Owner = { context: Context; scope: string }
type Result = { owner: Owner; data: Page | null; failed: boolean }
const key = (query: PipelinePageQuery) => JSON.stringify(pipelinePageQuery.parse(query))

/** One fresh page per selection. Retained metadata keeps controls editable;
 * earlier rows stay hidden until the current owner has a validated response. */
export function usePipelinePage({ clubId, query, revision, authority, enabled, initialData, validatedInitialData }: {
  clubId: string; query: PipelinePageQuery; revision: number; authority: object; enabled: boolean;
  initialData: Page | null; validatedInitialData: boolean;
}) {
  const parsed = pipelinePageQuery.safeParse(query)
  const scope = parsed.success ? JSON.stringify(parsed.data) : "invalid"
  const valid = parsed.success
  const context = useMemo(() => ({ clubId, authority, revision, enabled }), [clubId, authority, revision, enabled])
  // A boundary read may supply the next page before its cursor is selected.
  // Adopt that exact response once, without dispatching the same guarded GET.
  const prepared = useRef<Owner | null>(null)
  const owner = useMemo(() => prepared.current?.context === context && prepared.current.scope === scope ? prepared.current : { context, scope }, [context, scope])
  const [result, setResult] = useState<Result | null>(enabled && valid && validatedInitialData && initialData ? { owner, data: initialData, failed: false } : null)
  const latest = useRef({ owner, query, valid }), accepted = useRef(result), mounted = useRef(false)
  latest.current = { owner, query, valid }; accepted.current = result
  // A prepared owner is a one-render handoff, not a lookup cache. Consume it
  // on commit, including when another query wins before it can be adopted.
  useEffect(() => { prepared.current = null }, [owner])
  const reader = useRef<ReturnType<typeof serializedWorkspaceRead> | null>(null)
  useEffect(() => {
    mounted.current = true
    const instance = serializedWorkspaceRead(async () => {
      const request = latest.current
      if (!request.owner.context.enabled) return null
      // Invalid input must not overwrite the last editable metadata. A changed
      // authority has none: validate a default page before showing controls,
      // while keeping all applicant rows hidden until the input is valid.
      if (!request.valid && accepted.current?.owner.context === request.owner.context && accepted.current.data) return null
      recordWorkspaceRead("page", ["dispatch"])
      try { return { owner: request.owner, data: await getClubPipelinePage(request.owner.context.clubId, request.valid ? request.query : {}), failed: false } }
      catch { return { owner: request.owner, data: null, failed: true } }
    }, value => { if (value && mounted.current && latest.current.owner === value.owner) setResult(value) }, () => {})
    reader.current = instance
    return () => { mounted.current = false; instance.dispose(); if (reader.current === instance) reader.current = null }
  }, [])
  useEffect(() => {
    const hasMetadata = accepted.current?.owner.context === context && !!accepted.current.data
    if (enabled && (valid || !hasMetadata) && accepted.current?.owner !== owner) void reader.current?.refresh()
  }, [owner, context, enabled, valid])
  const isCurrent = useCallback(() => mounted.current && latest.current.owner === owner, [owner])
  const setData = useCallback((value: Page | null | ((previous: Page | null) => Page | null)) => {
    if (!mounted.current || latest.current.owner !== owner) return false
    setResult(previous => mounted.current && latest.current.owner === owner ? { owner, failed: false,
      data: typeof value === "function" ? value(previous?.owner === owner ? previous.data : null) : value } : previous)
    return true
  }, [owner])
  const acceptPage = useCallback((data: Page, next: PipelinePageQuery) => {
    if (!mounted.current || latest.current.owner !== owner) return false
    const nextScope = key(next)
    const nextOwner = nextScope === owner.scope ? owner : { context, scope: nextScope }
    prepared.current = nextOwner; setResult({ owner: nextOwner, data, failed: false })
    return true
  }, [context, owner])
  const retained = enabled && result?.owner.context === context ? result : null
  const current = retained?.owner === owner ? retained : null
  return { data: retained?.data ?? null, ready: !!current?.data && valid, invalid: !valid,
    loading: !retained && !current?.failed, error: current?.failed ?? false, setData, acceptPage, isCurrent }
}
