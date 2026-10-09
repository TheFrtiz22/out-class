"use client"

import { useState } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { StudentOnboardingWizard } from "@/components/views/student-onboarding-wizard"
import { LoginBrandPanel } from "./login-brand-panel"
import { Button } from "@/components/ui/button"
import { authEntryHref, signupReturnPath } from "@/lib/auth"
import { MICROSOFT_AUTH_ENABLED } from "@/lib/auth-features"
import type { User } from "@supabase/supabase-js"
import "./login.css"

export function SignupPageView({ initialUser, initialError = "" }: { initialUser: User | null; initialError?: string }) {
  const { isImpersonating } = useAuth()
  const demo = useDemoMode()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError)
  async function continueWithUva() {
    if (!MICROSOFT_AUTH_ENABLED || busy || isImpersonating || demo.isDemoEnabled) return
    setBusy(true)
    setError("")
    try {
      const query = new URLSearchParams(window.location.search)
      const next = signupReturnPath(query.get("next"))
      query.delete("next")
      if (next !== "/") query.set("next", next)
      window.location.href = `/auth/microsoft?next=${encodeURIComponent(authEntryHref("/signup", query.toString()))}`
    } catch {
      setError("Unable to start Microsoft sign-in. Please try again.")
      setBusy(false)
    }
  }
  if (isImpersonating) return <main className="p-8">Exit impersonation before creating an account.</main>
  if (demo.isDemoEnabled) return <main className="space-y-4 p-8"><p>Exit Demo Mode to create or access your account.</p><Button onClick={() => void demo.toggleDemo()}>Exit Demo Mode</Button></main>
  return <div className="oc-login oc-signup">
    <LoginBrandPanel signup />
    <main className="oc-login-auth" aria-label="Create your OutClass account">
      <nav className="oc-login-nav" aria-label="Return navigation"><Link href="/" className="oc-login-back">Back to home</Link></nav>
      <div className="oc-signup-content">
        <p className="oc-login-auth-description">For students and club leaders. Create your profile, then discover your campus.</p>
        <p className="oc-login-auth-description">Leading a club? Use your club’s invitation or claim its organization page after signing up. Club access requires verification and approval.</p>
        {MICROSOFT_AUTH_ENABLED && !initialUser && <><Button className="oc-login-uva" disabled={busy} onClick={() => void continueWithUva()}>{busy ? "Redirecting…" : "Continue with UVA"}</Button><p className="oc-login-auth-description">Or create an account with your UVA email below.</p></>}
        {error && <p role="alert" className="oc-login-error">{error}</p>}
        <fieldset disabled={busy}><StudentOnboardingWizard embedded initialUser={initialUser}
          onSignIn={() => { window.location.href = authEntryHref("/login", window.location.search) }}
          onComplete={() => {
            const next = signupReturnPath(new URLSearchParams(window.location.search).get("next"))
            window.location.href = next === "/" ? "/login" : next
          }}
        /></fieldset>
      </div>
    </main>
  </div>
}
