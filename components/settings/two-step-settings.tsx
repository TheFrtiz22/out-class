"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AuthenticatorCodeInput, AuthenticatorQr } from "@/components/security/authenticator-setup"

type Setup = { factorId: string; qr: string; secret: string }

export function TwoStepSettings({ enabled: initiallyEnabled, required, impersonating }: { enabled: boolean; required: boolean; impersonating: boolean }) {
  const [enabled, setEnabled] = useState(initiallyEnabled), [setup, setSetup] = useState<Setup | null>(null), [disabling, setDisabling] = useState(false)
  const [code, setCode] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("")
  async function call(body: object) {
    const response = await fetch("/api/auth/two-step", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw Error(result.error || "Two-step sign-in is temporarily unavailable.")
    return result
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("")
    try { await fn() } catch (reason) { setError(reason instanceof Error ? reason.message : "Something went wrong.") } finally { setBusy(false) }
  }
  const reset = () => { setSetup(null); setDisabling(false); setCode(""); setError("") }
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
      : enabled ? (required ? <p className="text-sm text-muted-foreground">Required for platform administrators.</p> : <Button variant="outline" disabled={busy} onClick={() => { setError(""); setMessage(""); setDisabling(true) }}>Turn off</Button>)
      : <Button variant="outline" disabled={busy} onClick={() => void run(async () => { setSetup(await call({ action: "enroll" })) })}>{busy ? "Starting…" : "Turn on"}</Button>}
    <p className="text-sm leading-6 text-muted-foreground">OutClass can’t show backup codes. Keep your authenticator app backed up; if you lose your phone, contact OutClass support from your university email to restore access.</p>
    {message && <p role="status" className="text-sm">{message}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>
}
