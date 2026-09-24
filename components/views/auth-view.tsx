"use client"

import { useState, useEffect, type FormEvent } from "react"
import { ArrowLeft, ArrowRight, Check, Loader2, Mail, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OutClassLogo } from "@/components/outclass-logo"
import { isUvaEmail, safeReturnPath } from "@/lib/auth"
import type { ViewId } from "@/lib/views"
import { createClient } from "@/utils/supabase/client"

/** Standard Microsoft 4-square logo — no extra dependency. */
function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" className={className} aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

export function AuthView({ onEnter, onBack, onCreateAccount, initialRole = "student", initialError = "" }: {
  onEnter: (view: ViewId) => void
  onBack: () => void
  onCreateAccount?: () => void
  initialRole?: "student" | "leader"
  /** Pre-populated error message, e.g. from an OAuth redirect error. */
  initialError?: string
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [microsoftLoading, setMicrosoftLoading] = useState(false)
  const [code, setCode] = useState("")
  const [step, setStep] = useState<"email" | "verify">("email")
  const [error, setError] = useState(initialError)
  const [notice, setNotice] = useState("")

  // Sync initialError prop (may arrive after mount if AppShell reads URL params)
  useEffect(() => {
    if (initialError) setError(initialError)
  }, [initialError])

  const supabase = createClient()

  async function handleMicrosoftLogin() {
    if (microsoftLoading) return
    setMicrosoftLoading(true)
    setError("")

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          scopes: "email",
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeReturnPath(new URLSearchParams(window.location.search).get("next")))}`,
        },
      })
      if (oauthError) throw oauthError
      // Keep the pending state while the browser redirects.
    } catch {
      setError("Unable to start Microsoft sign-in. Please try again.")
      setMicrosoftLoading(false)
    }
  }

  async function signIn(event: FormEvent) {
    event.preventDefault()
    if (!isUvaEmail(email)) { setError("Use your UVA email ending in @virginia.edu."); return }
    setLoading(true)
    setError("")
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (error) { setError(error.message); return }
      window.location.href = safeReturnPath(new URLSearchParams(window.location.search).get("next"))
    } catch { setError("Unable to sign in. Please try again.") }
    finally { setLoading(false) }
  }

  async function requestCode() {
    if (!isUvaEmail(email)) { setError("Enter your UVA email first."); return }
    setLoading(true)
    setError("")
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false } })
      if (error) { setError(error.message); return }
      setStep("verify")
      setNotice(`We sent a verification code to ${email}.`)
    } catch { setError("Unable to send a code. Try signing in with your password.") }
    finally { setLoading(false) }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    setError("")
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: "email",
      })
      if (verifyError) { setError(verifyError.message); return }
      window.location.href = safeReturnPath(new URLSearchParams(window.location.search).get("next"))
    } catch {
      setError("Unable to verify this code. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-svh bg-white font-sans text-neutral-900 lg:grid-cols-[1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#051B3D] p-12 text-white lg:flex xl:p-16">
        <OutClassLogo variant="dark" className="h-10 w-auto self-start" />
        <div className="relative z-10 max-w-lg py-16">
          <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80"><ShieldCheck className="size-4 text-orange-400" />Built for the UVA community</span>
          <h1 className="text-5xl font-semibold leading-[1.12] tracking-tight xl:text-6xl">Your next chapter<br />starts here.</h1>
          <p className="mt-6 max-w-sm text-base leading-7 text-slate-300">One profile. Every opportunity. Find your people and take your next step at UVA.</p>
          <ul className="mt-10 space-y-4 text-sm text-slate-200">
            {["Apply to clubs with one profile", "Keep every deadline in one place", "Get updates that keep you moving"].map((text) => <li key={text} className="flex items-center gap-3"><Check className="size-4 text-orange-400" />{text}</li>)}
          </ul>
        </div>
        <p className="text-xs text-slate-400">Built at UVA. Made for your next chapter.</p>
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-64 -right-64 size-[600px] rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -right-48 size-[470px] rounded-full border border-white/10" />
      </aside>
      <main className="flex min-h-svh flex-col px-6 py-7 sm:px-12 lg:px-16">
        <div className="flex items-center justify-between gap-4">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900"><ArrowLeft className="size-4" />Back to home</button>
          <OutClassLogo variant="light" className="h-7 w-auto lg:hidden" />
        </div>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-14">
          <div className="mb-6 flex size-12 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50">{step === "email" ? <ShieldCheck className="size-6 text-[#051B3D]" /> : <Mail className="size-6 text-[#051B3D]" />}</div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary">{step === "email" ? "Welcome to OutClass" : "Verify your email"}</p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{step === "email" ? "Log in. Find your people." : "Check your inbox."}</h2>
          <p className="mt-4 text-sm leading-6 text-neutral-500">{step === "email" ? "Sign in using your UVA Microsoft account or email." : <>Enter the six-digit code for <strong className="break-all font-medium text-neutral-900">{email}</strong>.</>}</p>
          {step === "email" ? (
            <>
              {/* ── Microsoft / UVA OAuth ── */}
              <div className="mt-8">
                <Button
                  type="button"
                  variant="outline"
                  disabled={microsoftLoading || loading}
                  onClick={handleMicrosoftLogin}
                  className="h-12 w-full gap-3 text-[15px] font-medium"
                >
                  {microsoftLoading ? (
                    <><Loader2 className="size-4 animate-spin" />Redirecting…</>
                  ) : (
                    <><MicrosoftIcon className="size-5" />Continue with UVA</>
                  )}
                </Button>
              </div>

              {/* ── Divider ── */}
              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-neutral-200" />
                <span className="text-xs font-medium text-neutral-400">or</span>
                <div className="h-px flex-1 bg-neutral-200" />
              </div>

              {/* ── Email / password form ── */}
              <form noValidate onSubmit={signIn} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="uva-email">UVA email address</Label>
                  <Input id="uva-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={(event) => { setEmail(event.target.value); setError("") }} aria-invalid={!!error} aria-describedby={error ? "email-hint auth-error" : "email-hint"} placeholder="computingid@virginia.edu" className="h-12" />
                  <p id="email-hint" className="text-xs text-neutral-500">Only @virginia.edu email addresses are supported.</p>
                </div>
                <div className="space-y-2"><Label htmlFor="login-password">Password</Label><Input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} className="h-12" /></div>
                {error && <p id="auth-error" role="alert" className="text-sm text-red-600">{error}</p>}
                <Button type="submit" disabled={loading || !password || microsoftLoading} className="h-12 w-full">{loading ? "Signing in…" : "Sign in"}<ArrowRight className="size-4" /></Button>
                <button type="button" disabled={loading || microsoftLoading} onClick={requestCode} className="w-full text-center text-xs text-neutral-500 underline">Use an email code instead (requires email delivery)</button>
              </form>
            </>
          ) : (
            <form onSubmit={verifyCode} className="mt-7 space-y-5">
              <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{notice}</div>
              <div className="space-y-2">
                <Label htmlFor="verification-code">Verification code</Label>
                <Input key="code" id="verification-code" autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setError("") }} aria-invalid={!!error} aria-describedby={error ? "auth-error" : undefined} placeholder="000000" className="h-14 text-center text-2xl tracking-[0.4em]" />
              </div>
              {error && <p id="auth-error" role="alert" className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={code.length !== 6} className="h-12 w-full">Verify and log in<ArrowRight className="size-4" /></Button>
              <div className="flex flex-wrap justify-between gap-3 text-xs">
                <button type="button" onClick={requestCode} disabled={loading} className="font-medium text-neutral-600 hover:text-neutral-900">Resend code</button>
                <button type="button" onClick={() => { setStep("email"); setCode(""); setError(""); setNotice("") }} className="font-medium text-neutral-600 hover:text-neutral-900">Use a different email</button>
              </div>
            </form>
          )}
          {onCreateAccount && <p className="mt-6 text-center text-sm text-neutral-600">New to OutClass? <button onClick={onCreateAccount} className="font-semibold text-primary underline">Create a student account</button></p>}
          <div className="mt-9 border-t border-neutral-200 pt-6 text-center">
            <p className="text-xs text-neutral-500">Just looking around?</p>
            <button type="button" onClick={() => onEnter(initialRole === "leader" ? "leader-dashboard" : "student-dashboard")} className="mt-2 text-sm font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900">Explore the demo</button>
          </div>
        </div>
        <p className="text-center text-xs text-neutral-400">For University of Virginia students and club leaders.</p>
      </main>
    </div>
  )
}

