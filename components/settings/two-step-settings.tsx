"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TurnstileWidget } from "@/components/security/turnstile-widget"
import { turnstileRequired, TURNSTILE_PENDING } from "@/lib/turnstile"
import { AuthenticatorCodeInput, AuthenticatorQr } from "@/components/security/authenticator-setup"
import { UserFacingError } from "@/lib/action-result"
import { userMessage } from "@/lib/user-message"

type Setup = { factorId: string; qr: string; secret: string }

export function TwoStepSettings({ enabled: initiallyEnabled, required, impersonating, passwordAccount = false }: { enabled: boolean; required: boolean; impersonating: boolean; passwordAccount?: boolean }) {
  const [confirming, setConfirming] = useState(false), [password, setPassword] = useState("")
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null), [turnstileReset, setTurnstileReset] = useState(0)
  const [enabled, setEnabled] = useState(initiallyEnabled), [setup, setSetup] = useState<Setup | null>(null), [disabling, setDisabling] = useState(false)
  const [code, setCode] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("")
  async function call(body: object) {
    const response = await fetch("/api/auth/two-step", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new UserFacingError(result.error || "Two-step sign-in is temporarily unavailable.")
    return result
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("")
    try { await fn() } catch (reason) { setError(userMessage(reason, "Something went wrong.")) } finally { setBusy(false) }
  }
  const reset = () => { setSetup(null); setDisabling(false); setConfirming(false); setPassword(""); setCode(""); setError("") }
  // Turning on needs fresh re-authentication: the current password, or a recent university sign-in.
  const enroll = (body: object = {}) => run(async () => { setSetup(await call({ action: "enroll", ...body })); setConfirming(false); setPassword("") })
  return <section className="space-y-3 py-5" aria-labelledby="two-step-heading">
    <h2 id="two-step-heading" className="oc-section-heading">Two-step sign-in</h2>
    <p className="text-sm leading-6 text-muted-foreground">{enabled ? "On. Signing in asks for a code from your authenticator app." : "Off. Add a code from an authenticator app to every sign-in."}</p>
    {impersonating ? <p className="text-sm text-muted-foreground">Exit the administrator support session before changing account security.</p>
      : setup ? <form className="space-y-4" onSubmit={e => { e.preventDefault(); void run(async () => { await call({ action: "confirm", factorId: setup.factorId, code }); setEnabled(true); reset(); setMessage("Two-step sign-in is on.") }) }}>
        <p className="text-sm">Scan with an authenticator app such as Google Authenticator, 1Password or Authy, then enter the 6-digit code it shows.</p>
        <AuthenticatorQr qr={setup.qr} secret={setup.secret} />
        <AuthenticatorCodeInput value={code} onChange={setCode} />
        <div className="flex flex-wrap gap-2"><Button disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify and turn on"}</Button><Button type="button" variant="outline" disabled={busy} onClick={reset}>Cancel</Button></div>
      </form>
      : disabling ? <form className="space-y-4" onSubmit={e => { e.preventDefault(); void run(async () => { await call({ action: "disable", code }); setEnabled(false); reset(); setMessage("Two-step sign-in is off.") }) }}>
        <AuthenticatorCodeInput value={code} onChange={setCode} label="Current authenticator code" />
        <div className="flex flex-wrap gap-2"><Button variant="destructive" disabled={busy || code.length !== 6}>{busy ? "Turning off…" : "Turn off"}</Button><Button type="button" variant="outline" disabled={busy} onClick={reset}>Cancel</Button></div>
      </form>
      : confirming ? <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (turnstileRequired && !turnstileToken) { setError(TURNSTILE_PENDING); return } setTurnstileReset(value => value + 1); void enroll({ password, ...(turnstileToken ? { turnstileToken } : {}) }) }}>
        <label className="block space-y-1 text-sm font-medium">Current password<Input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        <TurnstileWidget action="two-step" onToken={setTurnstileToken} resetKey={turnstileReset} />
        <div className="flex flex-wrap gap-2"><Button disabled={busy || !password}>{busy ? "Checking…" : "Continue"}</Button><Button type="button" variant="outline" disabled={busy} onClick={reset}>Cancel</Button></div>
      </form>
      : enabled ? (required ? <p className="text-sm text-muted-foreground">Required for platform administrators.</p> : <Button variant="outline" disabled={busy} onClick={() => { setError(""); setMessage(""); setDisabling(true) }}>Turn off</Button>)
      : <Button variant="outline" disabled={busy} onClick={() => { if (passwordAccount) { setError(""); setMessage(""); setConfirming(true) } else void enroll() }}>{busy ? "Starting…" : "Turn on"}</Button>}
    <p className="text-sm leading-6 text-muted-foreground">OutClass can’t show backup codes. Keep your authenticator app backed up; if you lose your phone, contact OutClass support from your university email to restore access.</p>
    {message && <p role="status" className="text-sm">{message}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>
}
