"use client"
import { PageHeader } from "@/components/product/page-header"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
export default function PlatformLogin() {
  const [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [factor, setFactor] = useState(""),
    [qr, setQr] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false)
  const { user, loading, isImpersonating } = useAuth()
  const demo = useDemoMode()
  async function run(fn: () => Promise<void>) {
  if (isImpersonating) return
    setBusy(true)
    setMessage("")
    try {
      await fn()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not authenticate.")
    } finally {
      setBusy(false)
    }
  }
    if (loading) return <main className="p-8" role="status">Checking your sign-in…</main>
  if (!user) return <main className="mx-auto max-w-lg space-y-5 p-8"><PageHeader title="Sign in before entering Admin" description="Use your normal OutClass account first, then verify your password and authenticator for Admin." /><Link className="underline" href="/?view=auth&next=%2Fplatform">Sign in to OutClass</Link></main>
  if (isImpersonating) return <main className="p-8">Exit impersonation above to restore platform administration.</main>
  if (demo.isDemoEnabled)
    return (
      <main className="p-8">
        <p>Exit Demo Mode before signing in to platform administration.</p>
        <Button onClick={() => void demo.toggleDemo()}>Exit demo</Button>
      </main>
    )
  return (
    <main data-workspace-detail className="mx-auto max-w-2xl space-y-6 p-8">
      <Link href="/" className="underline">
        Back to OutClass
      </Link>
      <PageHeader title="Platform administrator sign-in" illustration={{ variant: "columns", treatment: "quiet", accent: false }} />
      <p className="text-sm font-semibold">Re-authenticating {user.email}</p>
      <p>
        Verify your current account with your password and authenticator. Admin elevation expires after 30 minutes. A provisioned platform grant and server allowlist are required.
        Club ownership does not grant access.
      </p>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void run(async () => {
            const response = await fetch("/api/platform/elevation", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify(factor ? { action: "verify", code } : { action: "password", password }),
            })
            const result = await response.json()
            if (!response.ok) throw Error(result.error || "Could not authenticate.")
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
        <Button disabled={busy}>{factor ? "Verify and enter" : "Continue securely"}</Button>
      </form>
      {!factor && <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Forgot password?</Link>}
      <p role="alert">{message}</p>{factor && <Button variant="outline" disabled={busy} onClick={() => { setFactor(""); setCode(""); setQr(""); setMessage("") }}>Start again</Button>}
    </main>
  )
}
