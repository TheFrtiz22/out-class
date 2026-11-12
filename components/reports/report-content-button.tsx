"use client"
import { useId, useState } from "react"
import Link from "next/link"
import { Flag } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { NativeSelectField } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { hasWorkspace } from "@/lib/permissions"
import { reportContent } from "@/actions/content-reports"
import { REPORT_CONFIRMATION, REPORT_DETAILS_MAX, REPORT_REASONS, reportReasonLabels, type ReportReason, type ReportTarget } from "@/lib/content-reports"
import { cn } from "@/lib/utils"

/**
 * Low-emphasis "Report" for user-generated content (Terms §6; App Store 1.2). Signed-in, live
 * accounts only: hidden signed out, in Demo Mode, during support sessions, and on the viewer's
 * own content (their club's content, or their own profile or announcement). The server repeats
 * every check; this only keeps the control off pages where it cannot apply.
 */
export function ReportContentButton({ target, label = "Report", ownerClubId, ownerUserId, hidden = false, className }: {
  target: ReportTarget
  /** Accessible name; the visible text stays "Report". */
  label?: string
  /** Club whose staff own this content. */
  ownerClubId?: string
  /** User who owns this content. */
  ownerUserId?: string
  /** Caller-known reasons not to offer reporting (own content, no access). */
  hidden?: boolean
  className?: string
}) {
  const { user, isImpersonating } = useAuth()
  const demo = useDemoMode()
  const [open, setOpen] = useState(false), [reason, setReason] = useState<ReportReason | "">(""), [details, setDetails] = useState("")
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState<{ dmcaHref?: string } | null>(null)
  const ids = useId()
  if (!user || demo.isDemoEnabled || isImpersonating || hidden) return null
  if (ownerUserId && ownerUserId === user.id) return null
  if (ownerClubId && user.memberships?.some(m => m.clubId === ownerClubId && hasWorkspace(m))) return null
  function reset(next: boolean) {
    if (busy) return
    setOpen(next)
    if (!next) { setReason(""); setDetails(""); setError(""); setDone(null) }
  }
  async function submit() {
    if (!reason || busy) return
    setBusy(true); setError("")
    try {
      const result = await reportContent({ target, reason, details })
      if (result.ok) setDone({ dmcaHref: result.dmcaHref })
      else setError(result.error)
    } catch { setError("We couldn’t send your report. Please try again.") }
    finally { setBusy(false) }
  }
  return <Dialog open={open} onOpenChange={reset}>
    <DialogTrigger asChild>
      <Button type="button" variant="link" size="sm" data-report-content={target.type} aria-label={label} className={cn("h-auto px-0 text-xs font-normal text-muted-foreground", className)}>
        <Flag className="size-3.5" aria-hidden="true" />Report
      </Button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{label}</DialogTitle>
        <DialogDescription>{done ? REPORT_CONFIRMATION : "Reports go to the OutClass team. We don’t tell the person or club who reported them."}</DialogDescription>
      </DialogHeader>
      {done ? <>
        {done.dmcaHref && <p className="text-sm">For copyright claims, also send a notice as described in the <Link className="underline underline-offset-4" href={done.dmcaHref}>Terms</Link>.</p>}
        <DialogFooter><Button type="button" onClick={() => reset(false)}>Done</Button></DialogFooter>
      </> : <form className="space-y-4" onSubmit={e => { e.preventDefault(); void submit() }} aria-busy={busy}>
        <label className="block space-y-2 text-sm font-medium" htmlFor={`${ids}-reason`}>Reason
          <NativeSelectField id={`${ids}-reason`} className="w-full" required value={reason} disabled={busy} onChange={e => setReason(e.target.value as ReportReason)}>
            <option value="" disabled>Choose a reason</option>
            {REPORT_REASONS.map(value => <option key={value} value={value}>{reportReasonLabels[value]}</option>)}
          </NativeSelectField>
        </label>
        <label className="block space-y-2 text-sm font-medium" htmlFor={`${ids}-details`}>Details (optional)
          <Textarea id={`${ids}-details`} maxLength={REPORT_DETAILS_MAX} value={details} disabled={busy} onChange={e => setDetails(e.target.value)} />
          <span className="block text-xs font-normal text-muted-foreground">{details.length}/{REPORT_DETAILS_MAX}</span>
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => reset(false)}>Cancel</Button>
          <Button type="submit" disabled={busy || !reason}>{busy ? "Sending…" : "Submit report"}</Button>
        </DialogFooter>
      </form>}
    </DialogContent>
  </Dialog>
}
