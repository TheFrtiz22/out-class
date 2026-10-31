"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { inFlightWorkspaceRead } from "@/lib/in-flight-workspace-read"
import { useAuth } from "@/contexts/auth-context"
import { getClubPipelinePage } from "@/lib/workspace-api"
import { pagePipeline, pipelinePageQuery, type PipelinePageQuery } from "@/lib/pipeline-page"
import { recordWorkspaceRead } from "@/lib/workspace-read-diagnostics"
import { serializedWorkspaceRead } from "@/lib/serialized-workspace-read"

type Page = Awaited<ReturnType<typeof getClubPipelinePage>>
type Context = { clubId: string; authority: object; revision: number; enabled: boolean; readAuthority: object | undefined; isReadAuthorityCurrent: (authority: object | undefined) => boolean }
type Owner = { context: Context; scope: string }
type Result = { owner: Owner; data: Page | null; failed: boolean }
const key = (query: PipelinePageQuery) => JSON.stringify(pipelinePageQuery.parse(query))
const currentAuthority = (context: Context) => context.isReadAuthorityCurrent(context.readAuthority)

/** One fresh page per selection. Retained metadata keeps controls editable;
 * earlier rows stay hidden until the current owner has a validated response. */
export function usePipelinePage({ clubId, query, revision, authority, enabled, initialData, validatedInitialData, reviewerId, userId }: {
  clubId: string; query: PipelinePageQuery; revision: number; authority: object; enabled: boolean; reviewerId: string; userId: string;
  initialData: Page | null; validatedInitialData: boolean;
}) {
  const { readAuthority, isReadAuthorityCurrent } = useAuth()
  const parsed = pipelinePageQuery.safeParse(query)
  const scope = parsed.success ? JSON.stringify(parsed.data) : "invalid"
  const valid = parsed.success
  const context = useMemo(() => ({ clubId, authority, revision, enabled, readAuthority, isReadAuthorityCurrent }), [clubId, authority, revision, enabled, readAuthority, isReadAuthorityCurrent])
  // A boundary read may supply the next page before its cursor is selected.
  // Adopt that exact response once, without dispatching the same guarded GET.
  const prepared = useRef<Owner | null>(null)
  const owner = useMemo(() => prepared.current?.context === context && prepared.current.scope === scope ? prepared.current : { context, scope }, [context, scope])
  const [result, setResult] = useState<Result | null>(enabled && currentAuthority(context) && valid && validatedInitialData && initialData ? { owner, data: initialData, failed: false } : null)
  const latest = useRef({ owner, query, valid }), accepted = useRef(result), mounted = useRef(false)
  latest.current = { owner, query, valid }; accepted.current = result
  // A complete visible page is an explicitly covered dataset, not an auth
  // cache. Never carry it across visits, authority epochs or mutation revisions.
  const complete = useRef<{ context: Context; data: Page } | null>(null)
  const superseded = useRef<Result | null>(null)
  if (result?.owner.context === context) complete.current = result !== superseded.current && !result.failed && result.data?.coverage?.complete ? { context, data: result.data } : null
  const source = complete.current?.context === context ? complete.current.data : null
  const exact = result?.owner === owner
  const local = useMemo(() => !exact && valid && source && !query.gender && !query.genderCounts && (query.mode ?? "applicants") === source.coverage.mode
    ? { ...source, ...pagePipeline(source, query, reviewerId, userId, source.page.scope) } : null, [exact, valid, source, query, reviewerId, userId])
  // A prepared owner is a one-render handoff, not a lookup cache. Consume it
  // on commit, including when another query wins before it can be adopted.
  useEffect(() => { prepared.current = null }, [owner])
  const reader = useRef<ReturnType<typeof serializedWorkspaceRead> | null>(null)
  useEffect(() => {
    mounted.current = true
    const instance = serializedWorkspaceRead(async () => {
      const request = latest.current
      if (!request.owner.context.enabled || !currentAuthority(request.owner.context)) return null
      // Invalid input must not overwrite the last editable metadata. A changed
      // authority has none: validate a default page before showing controls,
      // while keeping all applicant rows hidden until the input is valid.
      if (!request.valid && accepted.current?.owner.context === request.owner.context && accepted.current.data) return null
      // Once a new guarded operation starts, its predecessor cannot become a
      // locally reusable dataset again (including after a denial or query race).
      superseded.current = accepted.current
      complete.current = null
      recordWorkspaceRead("page", ["dispatch"])
      try { return { owner: request.owner, data: await inFlightWorkspaceRead(request.owner.context, "pipelinePage", [request.owner.context.clubId, request.valid ? request.query : {}], () => getClubPipelinePage(request.owner.context.clubId, request.valid ? request.query : {})), failed: false } }
      catch { return { owner: request.owner, data: null, failed: true } }
    }, value => { if (value && mounted.current && latest.current.owner === value.owner && currentAuthority(value.owner.context)) setResult(value) }, () => {})
    reader.current = instance
    return () => { mounted.current = false; instance.dispose(); if (reader.current === instance) reader.current = null }
  }, [])
  useEffect(() => {
    const hasMetadata = accepted.current?.owner.context === context && !!accepted.current.data
    if (enabled && currentAuthority(context) && (valid || !hasMetadata) && !local && accepted.current?.owner !== owner) void reader.current?.refresh()
  }, [owner, context, enabled, valid, local])
  const isCurrent = useCallback(() => mounted.current && latest.current.owner === owner && currentAuthority(owner.context), [owner])
  const setData = useCallback((value: Page | null | ((previous: Page | null) => Page | null)) => {
    if (!mounted.current || latest.current.owner !== owner || !currentAuthority(owner.context)) return false
    setResult(previous => mounted.current && latest.current.owner === owner && currentAuthority(owner.context) ? { owner, failed: false,
      data: typeof value === "function" ? value(previous?.owner === owner ? previous.data : null) : value } : previous)
    return true
  }, [owner])
  const acceptPage = useCallback((data: Page, next: PipelinePageQuery) => {
    if (!mounted.current || latest.current.owner !== owner || !currentAuthority(owner.context)) return false
    const nextScope = key(next)
    const nextOwner = nextScope === owner.scope ? owner : { context, scope: nextScope }
    prepared.current = nextOwner; setResult({ owner: nextOwner, data, failed: false })
    return true
  }, [context, owner])
  const retained = enabled && currentAuthority(context) && result?.owner.context === context ? result : null
  const current = enabled && currentAuthority(context) && local ? { owner, data: local, failed: false } : retained?.owner === owner ? retained : null
  return { data: current?.data ?? retained?.data ?? null, ready: !!current?.data && valid, invalid: !valid,
    loading: !retained && !current?.failed, error: current?.failed ?? false, setData, acceptPage, isCurrent }
}
