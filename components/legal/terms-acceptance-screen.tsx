"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { acceptCurrentTerms } from "@/actions/terms"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { TermsClickwrap, clickwrapAnswer } from "@/components/legal/terms-clickwrap"
import { TERMS_REQUIRED_MESSAGE, termsGateExempt } from "@/lib/legal-versions"
import { CONTACT_EMAIL, CONTACT_HREF } from "@/lib/legal-content"

/** One-time acceptance screen shown in place of product pages (see TermsGate). */
export function TermsAcceptanceScreen({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/"
  const router = useRouter()
  const [checked, setChecked] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("")
  const [done, setDone] = useState(false)
  if (done || termsGateExempt(pathname)) return children

  async function accept() {
    if (!checked) { setError(TERMS_REQUIRED_MESSAGE); return }
    setBusy(true); setError("")
    try {
      const result = await acceptCurrentTerms({ ...clickwrapAnswer(true), source: "PROMPT" })
      if ("error" in result && result.error) { setError(result.error); setBusy(false); return }
      setDone(true)
      router.refresh()
    } catch { setError("Unable to save your agreement. Please try again."); setBusy(false) }
  }
  async function signOut() {
    setBusy(true)
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" })
      if (!response.ok) throw Error()
      const { createClient } = await import("@/utils/supabase/client")
      const { error } = await createClient().auth.signOut()
      if (error) throw error
      window.location.assign("/")
    } catch { setError("Could not sign out. Try again."); setBusy(false) }
  }

  return <main id="terms-acceptance" className="mx-auto flex min-h-[60dvh] w-full max-w-[var(--oc-reading-width)] flex-col justify-center gap-5 px-4 py-16 sm:px-6" aria-labelledby="terms-acceptance-title">
    <PageHeader title="Before you continue" titleId="terms-acceptance-title" description="Please review and accept the OutClass Terms of Service and Privacy Policy to keep using your account." />
    <TermsClickwrap id="terms-acceptance-check" checked={checked} disabled={busy} onCheckedChange={value => { setChecked(value); if (value) setError("") }} />
    {error && <p role="alert" className="oc-feedback">{error}</p>}
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => void accept()} loading={busy} disabled={busy}>Accept and continue</Button>
      <Button variant="ghost" onClick={() => void signOut()} disabled={busy}>Sign out</Button>
    </div>
    <p className="text-sm text-muted-foreground">To ask us to delete your account or send a copy of your data instead, email <a className="underline underline-offset-2" href={CONTACT_HREF}>{CONTACT_EMAIL}</a>. <Link className="underline underline-offset-2" href="/settings/account">Account settings</Link> stay available.</p>
  </main>
}
