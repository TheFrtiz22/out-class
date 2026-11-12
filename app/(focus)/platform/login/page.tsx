"use client"
import { UserFacingError } from "@/lib/action-result"
import { userMessage } from "@/lib/user-message"
import { PageHeader } from "@/components/ui/page-header"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { TurnstileWidget } from "@/components/security/turnstile-widget"
import { turnstileRequired, TURNSTILE_PENDING } from "@/lib/turnstile"
export default function PlatformLogin() {
  const [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [factor, setFactor] = useState(""),
    [qr, setQr] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null), [turnstileReset, setTurnstileReset] = useState(0)
  const { user, loading, isImpersonating } = useAuth()
  const demo = useDemoMode()
  async function run(fn: () => Promise<void>) {
  if (isImpersonating) return
    setBusy(true)
    setMessage("")
    try {
      await fn()
    } catch (e) {
      setMessage(userMessage(e, "Could not authenticate."))
    } finally {
      setBusy(false)
    }
  }
    if (loading) return <p role="status">Checking your sign-in…</p>
  if (!user) return <div className="space-y-5"><PageHeader title="Sign in before entering Admin" description="Use your normal OutClass account first, then verify your password and authenticator for Admin." /><Link className="underline" href="/login?next=%2Fplatform">Sign in to OutClass</Link></div>
  if (isImpersonating) return <p>Exit impersonation above to restore platform administration.</p>
  if (demo.isDemoEnabled)
    return (
      <div className="space-y-4">
        <p>Exit Demo Mode before signing in to platform administration.</p>
        <Button onClick={() => void demo.toggleDemo()}>Exit demo</Button>
      </div>
    )
  return (
    <div className="space-y-6">
      <PageHeader title="Platform administrator sign-in" />
      <p className="text-sm font-semibold">Re-authenticating {user.email}</p>
      <p>
        Verify your current account with your password and authenticator. Admin access lasts for this browser and authentication session. Sensitive actions require password and authenticator verification within the last five minutes. A provisioned platform grant and server allowlist are required.
        Club ownership does not grant access.
      </p>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!factor && turnstileRequired && !turnstileToken) { setMessage(TURNSTILE_PENDING); return }
          void run(async () => {
            if (!factor) setTurnstileReset(value => value + 1)
            const response = await fetch("/api/platform/elevation", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify(factor ? { action: "verify", code } : { action: "password", password, ...(turnstileToken ? { turnstileToken } : {}) }),
            })
            const result = await response.json()
            if (!response.ok) throw new UserFacingError(result.error || "Could not authenticate.")
            if (result.step === "mfa") { setFactor("challenge"); setPassword(""); setQr(result.qr || "") }
            else window.location.assign("/platform")
          })
        }}
      >
        {!factor ? (
          <>
            <label className="block">
              Password
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
          </>
        ) : (
          <>
            {qr && (
              <img src={qr} alt="Scan to enroll your authenticator" width={220} height={220} />
            )}
            <label className="block">
              Authenticator code
              <Input
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </label>
          </>
        )}
        {!factor && <TurnstileWidget action="admin" onToken={setTurnstileToken} resetKey={turnstileReset} />}
        <Button disabled={busy}>{factor ? "Verify and enter" : "Continue securely"}</Button>
      </form>
      {!factor && <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Forgot password?</Link>}
      <p role="alert">{message}</p>{factor && <Button variant="outline" disabled={busy} onClick={() => { setFactor(""); setCode(""); setQr(""); setMessage("") }}>Start again</Button>}
    </div>
  )
}
