"use client"
import { useDemoMode } from "@/contexts/demo-context"
import { useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
export default function PlatformLogin() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [factor, setFactor] = useState(""),
    [qr, setQr] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false)
  const demo = useDemoMode()
  const client = createClient()
  async function run(fn: () => Promise<void>) {
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
  if (demo.isDemoEnabled)
    return (
      <main className="p-8">
        <p>Exit Demo Mode before signing in to platform administration.</p>
        <Button onClick={() => void demo.toggleDemo()}>Exit demo</Button>
      </main>
    )
  return (
    <main className="mx-auto max-w-md space-y-6 p-8">
      <a href="/" className="underline">
        Back to OutClass
      </a>
      <h1 className="font-display text-3xl">Platform administrator sign-in</h1>
      <p>
        Requires a provisioned platform grant, server allowlist, and authenticator verification.
        Club ownership does not grant access.
      </p>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void run(async () => {
            if (!factor) {
              const signed = await client.auth.signInWithPassword({ email, password })
              if (signed.error) throw signed.error
              const factors = await client.auth.mfa.listFactors()
              if (factors.error) throw factors.error
              const existing = factors.data.totp.find((f) => f.status === "verified")
              if (existing) setFactor(existing.id)
              else {
                const enrolled = await client.auth.mfa.enroll({
                  factorType: "totp",
                  friendlyName: "OutClass platform",
                })
                if (enrolled.error) throw enrolled.error
                setFactor(enrolled.data.id)
                setQr(enrolled.data.totp.qr_code)
              }
            } else {
              const challenge = await client.auth.mfa.challengeAndVerify({ factorId: factor, code })
              if (challenge.error) throw challenge.error
              window.location.assign("/platform")
            }
          })
        }}
      >
        {!factor ? (
          <>
            <label className="block">
              UVA email
              <Input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
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
      <p role="alert">{message}</p>
    </main>
  )
}
