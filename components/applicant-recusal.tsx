"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useDemoMode } from "@/contexts/demo-context"
import { getApplicantRecusals, setApplicantRecusal } from "@/actions/recusals"

type State = Awaited<ReturnType<typeof getApplicantRecusals>>

/** One quiet line in the applicant dossier. Reviewers can step out of an
 * applicant they know; recruitment leads see who stepped out and can undo it. */
export function ApplicantRecusal({ clubId, applicationId, anonymous, onChanged }: { clubId: string; applicationId: string; anonymous: boolean; onChanged?: () => void }) {
  const demo = useDemoMode()
  const [state, setState] = useState<State | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [reload, setReload] = useState(0)
  useEffect(() => {
    if (demo.isDemoEnabled) return
    let current = true
    getApplicantRecusals({ clubId, applicationId }).then(next => { if (current) setState(next) }).catch(() => { if (current) setState(null) })
    return () => { current = false }
  }, [clubId, applicationId, reload, demo.isDemoEnabled])
  if (demo.isDemoEnabled || !state) return null
  async function change(recused: boolean, memberId?: string) {
    setBusy(true); setMessage("")
    try { await setApplicantRecusal({ clubId, applicationId, recused, ...(memberId ? { memberId } : {}) }); setReload(n => n + 1); onChanged?.() }
    catch (error) { setMessage(error instanceof Error ? error.message : "Couldn’t update. Try again.") }
    finally { setBusy(false) }
  }
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground" data-testid="applicant-recusal">
    {state.selfRecused ? <span>You’ve stepped out of reviewing, interviewing and voting on this applicant.</span>
      : !anonymous && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void change(true)} title="Step out of reviewing, interviewing and voting on this applicant">I know this applicant</Button>}
    {state.canManage && state.recused.length > 0 && <span>Stepped out: {state.recused.map((r, i) => <span key={r.memberId}>{i ? ", " : ""}{r.name} <Button variant="link" size="sm" className="h-auto p-0" disabled={busy} onClick={() => void change(false, r.memberId)}>Undo</Button></span>)}</span>}
    {message && <span role="alert" className="text-destructive">{message}</span>}
  </div>
}
