"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { announceDataChanged, useRevalidate } from "@/hooks/use-revalidate"
import { clearStagedDecision, listStagedDecisions, sendStagedDecisions, stageDecision } from "@/lib/workspace-api"
import { resolveStagedTarget, stagedLabel, type StageRound, type StagedDecisionView, type StagedOutcome } from "@/lib/staged-decisions"

export const STAGED_DECISIONS_SCOPE = "staged-decisions"
const UNDO_MS = 5000
type StageApp = { id: string; status: string; roundId: string }

/**
 * The one client path for decisions: list, review flow, board and Decide all stage, undo and send through
 * this hook, so a change on one surface reloads the others (`announceDataChanged("staged-decisions")`).
 * Staging is optimistic: the UI updates at once and rolls back with an error toast if the save fails.
 */
export function useStagedDecisions(clubId: string, { enabled, rounds, name }: { enabled: boolean; rounds: readonly StageRound[]; name?: (id: string) => string }) {
  const { user, readAuthority, isReadAuthorityCurrent } = useAuth()
  const demo = useDemoMode()
  const [items, setItems] = useState<Map<string, StagedDecisionView>>(new Map())
  const itemsRef = useRef(items); itemsRef.current = items
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const owner = `${clubId}:${user?.id}:${demo.isDemoEnabled}`
  const ownerRef = useRef(owner); ownerRef.current = owner
  // Optimistic writes in flight per applicant: a background reload never overwrites them.
  const pending = useRef(new Map<string, number>())
  const roundsRef = useRef(rounds); roundsRef.current = rounds
  const nameRef = useRef(name); nameRef.current = name

  const reload = useCallback(async () => {
    if (!enabled || !demo.ready || !user || !isReadAuthorityCurrent(readAuthority)) return
    const requested = ownerRef.current
    try {
      const rows = await listStagedDecisions(clubId)
      if (requested !== ownerRef.current) return
      setItems(current => {
        const next = new Map(rows.map(row => [row.applicationId, row]))
        for (const id of pending.current.keys()) { const keep = current.get(id); if (keep) next.set(id, keep); else next.delete(id) }
        return next
      })
      setLoaded(true); setFailed(false)
    } catch { if (requested === ownerRef.current) { setFailed(true); setLoaded(true) } }
  }, [clubId, enabled, demo.ready, user, readAuthority, isReadAuthorityCurrent])
  useEffect(() => { setItems(new Map()); setLoaded(false); void reload() }, [owner, reload])
  useRevalidate(reload, { scopes: [STAGED_DECISIONS_SCOPE, "applicants", "decisions"], enabled })

  const begin = (id: string) => pending.current.set(id, (pending.current.get(id) ?? 0) + 1)
  const end = (id: string) => { const n = (pending.current.get(id) ?? 1) - 1; if (n <= 0) pending.current.delete(id); else pending.current.set(id, n) }
  const put = (id: string, value: StagedDecisionView | undefined) => { const next = new Map(itemsRef.current); if (value) next.set(id, value); else next.delete(id); itemsRef.current = next; setItems(next) }

  /** Replace the applicant's staged decision with `value` (or remove it), optimistically. */
  const write = useCallback(async (app: StageApp, value: { outcome: StagedOutcome; roundId?: string | null } | null, previous: StagedDecisionView | undefined) => {
    const requested = ownerRef.current
    begin(app.id)
    if (value) {
      const target = resolveStagedTarget(app, roundsRef.current, value.outcome, value.roundId)
      put(app.id, { id: previous?.id ?? `pending-${app.id}`, applicationId: app.id, outcome: value.outcome, ...target, expectedStatus: app.status as StagedDecisionView["expectedStatus"], expectedRoundId: app.roundId, stagedBy: "You", stagedByMe: true, createdAt: previous?.createdAt ?? new Date().toISOString(),
        applicant: previous?.applicant ?? nameRef.current?.(app.id) ?? "Applicant", roundName: roundsRef.current.find(round => round.id === app.roundId)?.name ?? "", targetRoundName: target.targetRoundId ? roundsRef.current.find(round => round.id === target.targetRoundId)?.name ?? null : null })
    } else put(app.id, undefined)
    try {
      const saved = value
        ? await stageDecision({ clubId, applicationId: app.id, outcome: value.outcome, ...(value.roundId ? { roundId: value.roundId } : {}), expectedStatus: app.status as "IN_REVIEW", expectedRoundId: app.roundId })
        : (await clearStagedDecision({ clubId, applicationId: app.id }), undefined)
      if (requested === ownerRef.current) put(app.id, saved)
      announceDataChanged(STAGED_DECISIONS_SCOPE)
      return true
    } catch (error) {
      if (requested === ownerRef.current) put(app.id, previous)
      toast.error("Couldn’t save that decision", { description: error instanceof Error && /changed|permission|own application|stepped out|can't|can’t/i.test(error.message) ? error.message : "Check your access and try again. Nothing was sent to the applicant." })
      return false
    } finally { end(app.id) }
  }, [clubId])

  /** Stage an outcome, with an Undo toast for 5 seconds. Resolves false if it could not be saved. */
  const stage = useCallback(async (app: StageApp, outcome: StagedOutcome, roundId?: string | null) => {
    const previous = itemsRef.current.get(app.id)
    try { resolveStagedTarget(app, roundsRef.current, outcome, roundId) } catch (error) { toast.error(error instanceof Error ? error.message : "That decision isn’t available."); return false }
    const prior = previous
    const ok = await write(app, { outcome, roundId }, prior)
    if (ok) {
      const label = stagedLabel({ outcome, ...resolveStagedTarget(app, roundsRef.current, outcome, roundId) }, roundsRef.current)
      const who = nameRef.current?.(app.id)
      toast(`${label}${who ? ` · ${who}` : ""}`, { description: "Saved for Decide › Send. Nothing has been sent.", duration: UNDO_MS,
        action: { label: "Undo", onClick: () => { void write(app, prior ? { outcome: prior.outcome, roundId: prior.targetRoundId } : null, undefined) } } })
    }
    return ok
  }, [write])

  const unstage = useCallback(async (app: StageApp) => {
    const previous = itemsRef.current.get(app.id)
    if (!previous) return true
    const prior = previous
    const ok = await write(app, null, prior)
    if (ok) toast("Decision removed", { duration: UNDO_MS, action: { label: "Undo", onClick: () => { void write(app, { outcome: prior.outcome, roundId: prior.targetRoundId }, undefined) } } })
    return ok
  }, [write])

  const send = useCallback(async (applicationIds: string[]) => {
    const result = await sendStagedDecisions({ clubId, applicationIds, confirmed: true })
    announceDataChanged("applicants"); announceDataChanged("decisions"); announceDataChanged(STAGED_DECISIONS_SCOPE)
    await reload()
    return result
  }, [clubId, reload])

  return useMemo(() => ({ items, loaded, failed, reload, stage, unstage, send, get: (id: string) => items.get(id) }), [items, loaded, failed, reload, stage, unstage, send])
}
export type StagedDecisions = ReturnType<typeof useStagedDecisions>
