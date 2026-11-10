"use client"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { getVotingWorkspace, commandVotingSession } from "@/lib/workspace-api"
import { decisionsHref } from "@/lib/voting-navigation"
import { votingSessionStage } from "@/lib/voting-presentation"
import { formatDateTime } from "@/lib/copy/terms"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/loading-state"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

type Workspace = Awaited<ReturnType<typeof getVotingWorkspace>>
const outcomeLabels: Record<string, string> = { PASS: "Pass", HOLD: "Hold", NOT_PASS: "Do not pass", UNRESOLVED: "Unresolved" }

/**
 * Read-only history of a board (LEGACY) voting session, from before voting rooms became the one
 * voting system. It uses the same read and authorization as the retired board view: leaders with
 * decisions.view or decisions.manage see every session; voters see sessions they took part in.
 * Ballot privacy is unchanged: only outcomes and ballot counts, never other members' choices.
 * The one write closes an unfinished session (complete its open pass, then finish), with the same
 * capabilities as before (decisions.start, then decisions.finish).
 */
export function LegacyVotingHistory({ clubId, sessionId, demoScoped }: { clubId: string; sessionId: string; demoScoped: boolean }) {
  const auth = useAuth()
  const [data, setData] = useState<Workspace | null>(null), [error, setError] = useState(""), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [closeError, setCloseError] = useState("")
  const load = useCallback(async () => {
    setError("")
    try { setData(await getVotingWorkspace(clubId, sessionId)) }
    catch (reason) { setData(null); setError(reason instanceof Error ? reason.message : "This voting session is unavailable.") }
  }, [clubId, sessionId])
  useEffect(() => { if (!auth.loading) void load() }, [auth.loading, auth.user?.id, load])
  const back = decisionsHref(clubId, "voting", demoScoped ? "demo=1" : "")
  if (!auth.loading && !auth.user && !demoScoped) return <div className="vr-page vr-member space-y-4"><PageHeader title="Voting history" /><p>Sign in to see this voting session.</p><Link className="vr-link" href={`/login?next=${encodeURIComponent(`/voting/rooms/${sessionId}/history?clubId=${clubId}`)}`}>Sign in</Link></div>
  if (error) return <div className="vr-page vr-member space-y-4"><PageHeader title="Voting history" /><p role="alert">You don’t have access to this voting session, or it is unavailable.</p><Link className="vr-link" href={back}>Back to the Voting room</Link></div>
  const s = data?.session, summary = data?.summary
  if (!data || !s || !summary) return data ? <div className="vr-page vr-member space-y-4"><PageHeader title="Voting history" /><p role="status">This voting session is unavailable.</p><Link className="vr-link" href={back}>Back to the Voting room</Link></div> : <LoadingState label="Loading voting history…" layout="rows" rows={4} />
  const current = s.passes.find(p => p.number === s.currentPass)
  const unfinished = !s.publishedAt && (s.state === "OPEN" || s.state === "PAUSED")
  const canClose = unfinished && data.canStart && data.canFinish
  const round = data.rounds.find(r => r.id === s.roundId)?.name ?? "Recruitment round"
  const label = (id: string) => data.candidateLabels.find(c => c.id === id)?.label ?? "Applicant"
  async function close() {
    if (busy || !s) return
    setBusy(true); setCloseError("")
    try {
      let revision = s.revision
      if (current?.state === "OPEN") revision = (await commandVotingSession({ clubId, sessionId: s.id, revision, action: "COMPLETE_PASS" })).revision
      await commandVotingSession({ clubId, sessionId: s.id, revision, action: "FINISH" })
      setConfirm(false); await load()
    } catch (reason) { setCloseError(reason instanceof Error ? reason.message : "The session could not be closed. Reload and try again.") }
    finally { setBusy(false) }
  }
  return <div className="vr-page space-y-5">
    <PageHeader eyebrow={round} title="Voting history" description="This session used the earlier board voting tool. It is read-only; new sessions run in voting rooms." />
    <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">{votingSessionStage(s)}</span> · Created {formatDateTime(s.createdAt)}{s.endedAt ? ` · Closed ${formatDateTime(s.endedAt)}` : ""}</p>
    {s.state === "DRAFT" && <p role="status">This session was set up but never started. No ballots were cast.</p>}
    {unfinished && <section aria-label="Unfinished session" className="space-y-3 border-y py-3">
      <p>This session was not closed. Voting can no longer continue here{current?.state === "OPEN" ? "; closing it completes the open pass and keeps every ballot already cast" : ""}.</p>
      {canClose ? <Button variant="outline" disabled={busy} onClick={() => { setCloseError(""); setConfirm(true) }}>Close session</Button> : <p className="text-sm text-muted-foreground">A club leader who can start and finish voting can close it.</p>}
    </section>}
    <dl className="vr-stats">{[["Passed", summary.passed], ["Hold", summary.held], ["Not passed", summary.notPassed], ["Unresolved", summary.unresolved], ["Target", summary.target]].map(([name, value]) => <div key={name}><dt className="text-xs text-muted-foreground">{name}</dt><dd className="font-medium tabular-nums">{value}</dd></div>)}</dl>
    <section aria-labelledby="legacy-voting-outcomes"><h2 id="legacy-voting-outcomes" className="mb-2">Outcomes</h2>
      {summary.outcomes.length ? <ul className="divide-y border-y">{summary.outcomes.map(o => {
        const entry = s.passes.find(p => p.number === o.passNumber)?.candidates.find(c => c.applicationId === o.applicationId)
        return <li key={o.applicationId} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <p className="min-w-0 font-medium">{label(o.applicationId)}</p>
          <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">{outcomeLabels[o.outcome] ?? o.outcome}</span>{entry?.override ? " · Leader decision" : o.automatic ? " · Voting rule" : ""}{o.passNumber ? ` · Pass ${o.passNumber} · ${entry?.ballotCount ?? 0} of ${s.participants.length} ballots` : " · Not voted"}</p>
        </li>
      })}</ul> : <p className="text-sm text-muted-foreground">No candidates.</p>}
    </section>
    <Link className="vr-link inline-flex min-h-11 items-center" href={back}>Back to the Voting room</Link>
    {canClose && <AlertDialog open={confirm} onOpenChange={open => { if (!open && !busy) setConfirm(false) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Close this voting session?</AlertDialogTitle><AlertDialogDescription>{current?.state === "OPEN" ? "The open pass is completed and ballots already cast are kept. " : ""}The session is then closed and stays read-only. Application statuses do not change.</AlertDialogDescription></AlertDialogHeader>{closeError && <p role="alert" className="text-sm">{closeError}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><Button disabled={busy} onClick={() => void close()}>{busy ? "Closing…" : "Close session"}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>}
  </div>
}
