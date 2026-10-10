"use client"

import { useAuth } from "@/contexts/auth-context"
import { useState, useEffect, type FormEvent } from "react"
import { LoginBrandPanel } from "@/components/auth/login-brand-panel"
import { LoginAuthPanel } from "@/components/auth/login-auth-panel"
import "@/components/auth/login.css"
import { isUvaEmail, loginReturnPath } from "@/lib/auth"
import type { ViewId } from "@/lib/views"
import { createClient } from "@/utils/supabase/client"
import Link from "next/link"
import { authEmailError, confirmedEmailSession } from "@/lib/auth-email"
import { MICROSOFT_AUTH_ENABLED } from "@/lib/auth-features"

export function AuthView({ onEnter, onBack, onCreateAccount, initialRole = "student", initialError = "" }: {
  onEnter: (view: ViewId) => void
  onBack: () => void
  onCreateAccount?: () => void
  initialRole?: "student" | "leader"
  /** Pre-populated error message, e.g. from an OAuth redirect error. */
  initialError?: string
}) {
  const { isImpersonating } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailExpanded, setEmailExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [microsoftLoading, setMicrosoftLoading] = useState(false)
  const [code, setCode] = useState("")
  const [step, setStep] = useState<"email" | "verify">("email")
  const [error, setError] = useState(initialError)
  const [resendSeconds, setResendSeconds] = useState(0)
  useEffect(() => {
    if (resendSeconds <= 0) return
    const timer = setTimeout(() => setResendSeconds(value => Math.max(0, value - 1)), 1000)
    return () => clearTimeout(timer)
  }, [resendSeconds])
  const [notice, setNotice] = useState("")

  // Sync initialError prop (may arrive after mount if AppShell reads URL params)
  useEffect(() => {
    if (initialError) setError(initialError)
  }, [initialError])

  const supabase = createClient()

  async function handleMicrosoftLogin() {
    if (!MICROSOFT_AUTH_ENABLED || isImpersonating) return
    if (microsoftLoading) return
    setMicrosoftLoading(true)
    setError("")

    try {
      window.location.href = `/auth/microsoft?next=${encodeURIComponent(loginReturnPath(new URLSearchParams(window.location.search).get("next")))}`
      // Keep the pending state while the browser redirects.
    } catch {
      setError("Unable to start Microsoft sign-in. Please try again.")
      setMicrosoftLoading(false)
    }
  }

  async function signIn(event: FormEvent) {
    event.preventDefault()
    if (isImpersonating || loading) return
    if (!isUvaEmail(email)) { setError("Use your UVA email ending in @virginia.edu."); return }
    setLoading(true)
    setError("")
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (error) { setError(error.message); return }
      window.location.href = loginReturnPath(new URLSearchParams(window.location.search).get("next"))
    } catch { setError("Unable to sign in. Please try again.") }
    finally { setLoading(false) }
  }

  async function requestCode() {
    if (isImpersonating || loading || resendSeconds > 0) return
    if (!isUvaEmail(email)) { setError("Enter your UVA email first."); return }
    setLoading(true)
    setError("")
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false } })
      if (error) { setError(authEmailError(error, "send")); if (error.status === 429) setResendSeconds(60); return }
      setEmail(email.trim().toLowerCase())
      setResendSeconds(60)
      setStep("verify")
      setNotice(`Code sent. We sent a 6-digit code to ${email}.`)
    } catch { setError("Unable to send a code. Try signing in with your password.") }
    finally { setLoading(false) }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    if (isImpersonating) return
    if (loading || !/^\d{6}$/.test(code)) return
    setLoading(true)
    setError("")
    try {
      const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: "email",
      })
      if (verifyError) { setError(authEmailError(verifyError, "verify")); return }
      const { data: current, error: identityError } = await supabase.auth.getUser()
      if (identityError || !confirmedEmailSession({ session: verified.session, user: current.user }, email)) {
        await supabase.auth.signOut()
        setError("Unable to confirm your sign-in. Please try again.")
        return
      }
      window.location.href = loginReturnPath(new URLSearchParams(window.location.search).get("next"))
    } catch {
      setError("Unable to verify this code. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (isImpersonating) return <main className="p-8">Exit impersonation above before changing authentication. <Link className="underline" href="/?workspace=student">Return to the user’s workspace</Link></main>

  return (
    <div className="oc-login">
      <LoginBrandPanel />
      <LoginAuthPanel
        step={step}
        emailExpanded={emailExpanded}
        email={email}
        password={password}
        code={code}
        error={error}
        notice={notice}
        loading={loading}
        microsoftLoading={microsoftLoading}
        resendSeconds={resendSeconds}
        onToggleEmail={() => setEmailExpanded(value => !value)}
        onEmailChange={value => { setEmail(value); setError("") }}
        onPasswordChange={setPassword}
        onCodeChange={value => { setCode(value.replace(/\D/g, "").slice(0, 6)); setError("") }}
        onMicrosoftLogin={handleMicrosoftLogin}
        onSignIn={signIn}
        onRequestCode={requestCode}
        onVerifyCode={verifyCode}
        onDifferentEmail={() => { setStep("email"); setEmailExpanded(true); setCode(""); setError(""); setNotice("") }}
        onBack={onBack}
        onCreateAccount={onCreateAccount}
      />
    </div>
  )
}
