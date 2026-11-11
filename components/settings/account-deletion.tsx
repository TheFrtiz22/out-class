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

export type PendingAccountDeletion = { requestedAt: string; scheduledFor: string } | null

const longDate = (iso: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "America/New_York" }).format(new Date(iso))

export function AccountDeletion({ email, passwordAccount, pending: initial }: { email: string; passwordAccount: boolean; pending: PendingAccountDeletion }) {
  const confirm = useConfirm(), router = useRouter()
  const [pending, setPending] = useState(initial)
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
      setPending({ requestedAt: result.requestedAt, scheduledFor: result.scheduledFor })
      setTyped(""); setPassword("")
      setMessage(result.emailSent ? "Request received. We sent a confirmation to your university email." : "Request received. We couldn’t send the confirmation email, but your request is saved.")
      router.refresh()
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not request deletion.") }
    finally { setBusy(false); setTurnstileReset(value => value + 1) }
  }

  async function cancel() {
    setMessage(""); setError(""); setBusy(true)
    try {
      await cancelAccountDeletion()
      setPending(null)
      setMessage("Deletion cancelled. Your account stays as it is.")
      router.refresh()
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not cancel the request.") }
    finally { setBusy(false) }
  }

  return <section className="space-y-3 py-5" aria-labelledby="delete-account-heading">
    <h2 id="delete-account-heading" className="oc-section-heading">Delete account</h2>
    {pending ? <>
      <p className="text-sm leading-6">Your account is scheduled for deletion on <strong>{longDate(pending.scheduledFor)}</strong>.</p>
      <Button variant="outline" disabled={busy} onClick={() => void cancel()}>{busy ? "Cancelling…" : "Cancel deletion"}</Button>
    </> : <>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
        <li>Your profile, résumé, headshot and applications are deleted.</li>
        <li>Club records others rely on, like decisions, attendance and audit history, keep a minimal anonymized reference.</li>
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
    {message && <p role="status" className="text-sm">{message}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>
}
