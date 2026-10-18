"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"

export function AccountSettings({ email, passwordAccount, impersonating }: { email: string; passwordAccount: boolean; impersonating: boolean }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("")
  async function requestPasswordReset() {
    setBusy(true); setMessage(""); setError("")
    try {
      const response = await fetch("/api/auth/password-recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "request", email }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Could not request a password reset.")
      setMessage(result.message || "Check your university email for password reset instructions.")
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not request a password reset.") }
    finally { setBusy(false) }
  }
  return <div className="max-w-2xl divide-y rounded-lg border bg-card px-5">
    <section className="py-5"><h2 className="oc-section-heading">Sign-in information</h2><dl className="mt-4 space-y-4 text-sm"><div><dt className="text-muted-foreground">University email</dt><dd className="mt-1 break-all font-medium">{email}</dd></div><div><dt className="text-muted-foreground">University</dt><dd className="mt-1">University of Virginia</dd></div><div><dt className="text-muted-foreground">Sign-in method</dt><dd className="mt-1">{passwordAccount ? "Email and password" : "University sign-in"}</dd></div></dl></section>
    <section className="space-y-3 py-5"><h2 className="oc-section-heading">Password & security</h2><p className="text-sm leading-6 text-muted-foreground">{passwordAccount ? "Request a secure reset link at your university email to change your password." : "Your sign-in provider manages your password. Use your university account’s security settings to update it."}</p>{passwordAccount && <Button variant="outline" disabled={busy || impersonating} onClick={() => void requestPasswordReset()}>{busy ? "Sending…" : "Send password reset email"}</Button>}{impersonating && <p className="text-sm text-muted-foreground">Exit the administrator support session before changing account security.</p>}{message && <p role="status" className="text-sm">{message}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</section>
  </div>
}
