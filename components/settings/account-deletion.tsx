"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { TurnstileWidget } from "@/components/security/turnstile-widget"
import { turnstileRequired, TURNSTILE_PENDING } from "@/lib/turnstile"
import { cancelAccountDeletion, requestAccountDeletion } from "@/actions/account-deletion"
import { accountDeletionConfirmationMatches } from "@/lib/account-deletion"
import { userMessage } from "@/lib/user-message"

export type PendingAccountDeletion = { requestedAt: string; scheduledFor: string; emailSent: boolean } | null

const longDate = (iso: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "America/New_York" }).format(new Date(iso))

export function AccountDeletion({ email, passwordAccount, pending: initial, warnings: initialWarnings = [] }: { email: string; passwordAccount: boolean; pending: PendingAccountDeletion; warnings?: string[] }) {
  const confirm = useConfirm(), router = useRouter()
  const [pending, setPending] = useState(initial), [warnings, setWarnings] = useState(initialWarnings)
  const [typed, setTyped] = useState(""), [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("")
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null), [turnstileReset, setTurnstileReset] = useState(0)
  const ready = accountDeletionConfirmationMatches(typed, email) && (!passwordAccount || password.length > 0)

  async function submit() {
    setMessage(""); setError("")
    if (passwordAccount && turnstileRequired && !turnstileToken) { setError(TURNSTILE_PENDING); return }
    const ok = await confirm({
      title: "Delete your OutClass account?",
      description: "Your account will be deleted in 14 days. You can cancel any time before then from this page.",
      confirmLabel: "Delete account",
      tone: "danger",
    })
    if (!ok) return
    setBusy(true)
    try {
      const result = await requestAccountDeletion({ confirmation: typed, ...(passwordAccount ? { password, turnstileToken: turnstileToken ?? undefined } : {}) })
      setPending({ requestedAt: result.requestedAt, scheduledFor: result.scheduledFor, emailSent: result.emailSent })
      setWarnings(result.warnings)
      setTyped(""); setPassword("")
      setMessage(result.emailSent ? "Request received. We sent a confirmation to your university email." : "")
      router.refresh()
    } catch (reason) { setError(userMessage(reason, "We couldn’t request deletion. Check your password and confirmation, then try again.")) }
    finally { setBusy(false); setTurnstileReset(value => value + 1) }
  }

  async function cancel() {
    setMessage(""); setError(""); setBusy(true)
    try {
      await cancelAccountDeletion()
      setPending(null)
      setMessage("Deletion cancelled. Your account stays as it is.")
      router.refresh()
    } catch (reason) { setError(userMessage(reason, "We couldn’t cancel the request. Reload the page and try again.")) }
    finally { setBusy(false) }
  }

  return <section className="space-y-3 py-5" aria-labelledby="delete-account-heading">
    <h2 id="delete-account-heading" className="oc-section-heading">Delete account</h2>
    {pending ? <>
      <p className="text-sm leading-6">Your account is scheduled for deletion on <strong>{longDate(pending.scheduledFor)}</strong>.</p>
      {!pending.emailSent && <p role="status" className="text-sm">We couldn’t send the confirmation email. Your request is saved, and you can cancel here until that date.</p>}
      <Button variant="outline" disabled={busy} onClick={() => void cancel()}>{busy ? "Cancelling…" : "Cancel deletion"}</Button>
    </> : <>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
        <li>Your profile, résumé, headshot, files and in-progress applications are deleted.</li>
        <li>For decided applications, the club keeps its own review notes and the decision, linked to an anonymized placeholder. Your answers are removed.</li>
        <li>Decision letters and interview copies of your résumé that a club already holds stay with that club’s records.</li>
        <li>Attendance and audit history keep only the anonymized placeholder.</li>
        <li>You can cancel within 14 days.</li>
      </ul>
      <div className="space-y-1.5">
        <Label htmlFor="delete-account-confirm">Type your university email or DELETE</Label>
        <Input id="delete-account-confirm" autoComplete="off" spellCheck={false} value={typed} onChange={event => setTyped(event.target.value)} />
      </div>
      {passwordAccount ? <div className="space-y-1.5">
        <Label htmlFor="delete-account-password">Current password</Label>
        <Input id="delete-account-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} />
        <TurnstileWidget action="account-deletion" onToken={setTurnstileToken} resetKey={turnstileReset} />
      </div> : <p className="text-sm text-muted-foreground">If you signed in more than 10 minutes ago, sign out and back in first.</p>}
      <Button variant="destructive" disabled={busy || !ready} onClick={() => void submit()}>{busy ? "Requesting…" : "Delete account"}</Button>
    </>}
    {warnings.map(warning => <p key={warning} className="text-sm text-muted-foreground">{warning}</p>)}
    {message && <p role="status" className="text-sm">{message}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>
}
