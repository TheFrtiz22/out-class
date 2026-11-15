"use client"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/ui/panel"
import { LoadingState } from "@/components/ui/loading-state"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { useDemoMode } from "@/contexts/demo-context"
import { useStagedDecisions } from "@/hooks/use-staged-decisions"
import { stagedLabel, type StagedDecisionView } from "@/lib/staged-decisions"
import { pluralize } from "@/lib/copy/terms"
import { formatPhone, phoneHref } from "@/lib/phone"
import { Phone } from "@/components/icons"

const order: Record<string, number> = { ACCEPTED: 0, INTERVIEWING: 1, IN_REVIEW: 1, WAITLISTED: 2, REJECTED: 3 }

/**
 * Decide › Send: decisions saved during review, waiting to go out. Sending applies each one through the same
 * decision publisher as an individual decision (status, offer, letter, notification and email per club settings).
 * An applicant who changed since the decision was saved is skipped and stays here.
 */
export function StagedDecisionsPanel({ clubId, roundId }: { clubId: string; roundId?: string }) {
  const demo = useDemoMode()
  const confirm = useConfirm()
  const staged = useStagedDecisions(clubId, { enabled: true, rounds: [] })
  const [selected, setSelected] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [stale, setStale] = useState<{ applicationId: string; reason: string }[]>([])
  const rows = useMemo(() => [...staged.items.values()].filter(row => !roundId || row.expectedRoundId === roundId).sort((a, b) => (order[a.targetStatus] ?? 9) - (order[b.targetStatus] ?? 9) || a.applicant.localeCompare(b.applicant)), [staged.items, roundId])
  const chosen = selected === null ? rows.map(row => row.applicationId) : selected.filter(id => rows.some(row => row.applicationId === id))
  const toggle = (id: string) => setSelected(current => { const base = current ?? rows.map(row => row.applicationId); return base.includes(id) ? base.filter(item => item !== id) : [...base, id] })
  const groups = useMemo(() => {
    const map = new Map<string, StagedDecisionView[]>()
    for (const row of rows) { const label = stagedLabel(row, []); map.set(label, [...(map.get(label) ?? []), row]) }
    return [...map]
  }, [rows])
  async function send() {
    if (!chosen.length) return
    const finals = rows.filter(row => chosen.includes(row.applicationId) && ["ACCEPTED", "REJECTED", "WAITLISTED"].includes(row.targetStatus)).length
    if (!(await confirm({ title: `Send ${pluralize(chosen.length, "decision")}?`, description: `${finals ? `${pluralize(finals, "applicant")} will see their decision${demo.isDemoEnabled ? " (fictional letters only; no email in Demo)" : ", with a letter and email according to your club's settings"}. ` : ""}Round moves notify applicants that they advanced. This can't be undone from here.`, confirmLabel: "Send now" }))) return
    setBusy(true)
    try {
      const result = await staged.send(chosen.slice(0, 200))
      setStale(result.stale); setSelected(null)
      toast.success(`${pluralize(result.sent, "decision")} sent`, { description: result.stale.length ? `${pluralize(result.stale.length, "applicant")} changed and stayed here.` : undefined })
    } catch { toast.error("Couldn’t send these decisions", { description: "Nothing was sent. Check your access and try again." }) }
    finally { setBusy(false) }
  }
  return <Panel as="section" aria-labelledby="staged-heading" className="oc-workspace-stack">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="staged-heading" className="oc-section-heading">Decisions to send</h2>
        <p className="text-sm text-muted-foreground">Saved during review. Applicants see nothing until you send.</p></div>
      <Button disabled={busy || !chosen.length} onClick={() => void send()}>{busy ? "Sending…" : chosen.length === rows.length ? `Send all ${rows.length || ""}`.trim() : `Send ${chosen.length} selected`}</Button>
    </div>
    {!staged.loaded ? <LoadingState label="Loading saved decisions…" layout="rows" rows={2} />
      : staged.failed ? <div role="alert" className="flex items-center gap-2"><p className="text-sm">Saved decisions couldn’t be loaded.</p><Button variant="outline" size="sm" onClick={() => void staged.reload()}>Retry</Button></div>
      : !rows.length ? <p className="text-sm text-muted-foreground">No saved decisions{roundId ? " in this round" : ""}. Review applicants to add some.</p>
      : <div className="space-y-4">{groups.map(([label, items]) => <section key={label} aria-label={`${label}, ${items.length}`}>
          <h3 className="mb-1 text-sm font-semibold">{label} <span className="font-normal text-muted-foreground">{items.length}</span></h3>
          <ul className="divide-y border-y">{items.map(row => {
            const skipped = stale.find(item => item.applicationId === row.applicationId)
            return <li key={row.id} className="flex flex-wrap items-center gap-3 py-2">
              <input type="checkbox" className="oc-checkbox" aria-label={`Send decision for ${row.applicant}`} checked={chosen.includes(row.applicationId)} onChange={() => toggle(row.applicationId)} disabled={busy} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{row.applicant}</p><p className="text-xs text-muted-foreground">{row.roundName} · saved by {row.stagedByMe ? "you" : row.stagedBy}{skipped && <span className="text-destructive"> · Not sent: {skipped.reason}</span>}</p></div>
              {phoneHref(row.phone) && <a className="inline-flex items-center gap-1.5 text-sm tabular-nums underline underline-offset-4" href={phoneHref(row.phone)} aria-label={`Call ${row.applicant} at ${formatPhone(row.phone)}`} data-testid="offer-phone"><Phone size={14} aria-hidden="true" />{formatPhone(row.phone)}</a>}
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void staged.unstage({ id: row.applicationId, status: row.expectedStatus, roundId: row.expectedRoundId })}>Remove</Button>
            </li>
          })}</ul>
        </section>)}</div>}
  </Panel>
}
