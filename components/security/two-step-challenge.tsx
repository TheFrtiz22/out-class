"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { AuthenticatorCodeInput } from "@/components/security/authenticator-setup"
import { UserFacingError } from "@/lib/action-result"
import { userMessage } from "@/lib/user-message"

export function TwoStepChallenge({ next, demo = false }: { next: string; demo?: boolean }) {
  const [inDemo, setInDemo] = useState(demo), [code, setCode] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false)
  async function verify() {
    setBusy(true); setError("")
    try {
      const response = await fetch("/api/auth/two-step", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "challenge", code }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new UserFacingError(result.error || "Could not verify your code.")
      window.location.assign(next)
    } catch (reason) { setError(userMessage(reason, "Could not verify your code.")); setCode(""); setBusy(false) }
  }
  async function exitDemo() {
    setBusy(true); setError("")
    try {
      const response = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: false }) })
      if (!response.ok) throw Error()
      setInDemo(false)
    } catch { setError("Could not leave Demo Mode. Try again.") } finally { setBusy(false) }
  }
  async function signOut() {
    setBusy(true)
    try { await fetch("/api/auth/logout", { method: "POST" }) } finally { window.location.assign("/") }
  }
  return <div className="space-y-5">
    <PageHeader title="Two-step sign-in" description="Enter the 6-digit code from your authenticator app." />
    {inDemo ? <div className="oc-form-section space-y-3">
      <p className="text-sm">Demo Mode is on in this browser. Leave it to finish signing in.</p>
      <Button disabled={busy} onClick={() => void exitDemo()}>{busy ? "Leaving…" : "Leave Demo Mode"}</Button>
      <p role="alert" className="text-sm text-destructive">{error}</p>
    </div> : <form className="oc-form-section space-y-4" onSubmit={e => { e.preventDefault(); void verify() }}>
      <AuthenticatorCodeInput value={code} onChange={setCode} />
      <Button disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify"}</Button>
      <p role="alert" className="text-sm text-destructive">{error}</p>
    </form>}
    <p className="text-sm text-muted-foreground">Lost your phone? Contact OutClass support from your university email to restore access.</p>
    <Button variant="outline" disabled={busy} onClick={() => void signOut()}>Sign out</Button>
  </div>
}
