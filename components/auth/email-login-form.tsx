import type { FormEvent } from "react"
import Link from "next/link"
import { ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type EmailLoginFormProps = {
  email: string
  password: string
  error: string
  loading: boolean
  microsoftLoading: boolean
  resendSeconds: number
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSignIn: (event: FormEvent) => void
  onRequestCode: () => void
}

export function EmailLoginForm({ email, password, error, loading, microsoftLoading, resendSeconds, onEmailChange, onPasswordChange, onSignIn, onRequestCode }: EmailLoginFormProps) {
  const busy = loading || microsoftLoading
  return (
    <form noValidate onSubmit={onSignIn} className="oc-login-email-form" aria-busy={busy}>
      <div className="oc-login-field">
        <Label htmlFor="uva-email">Email address</Label>
        <Input id="uva-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required disabled={busy} value={email} onChange={event => onEmailChange(event.target.value)} aria-invalid={!!error} aria-describedby={error ? "email-hint auth-error" : "email-hint"} placeholder="computingid@virginia.edu" />
        <p id="email-hint" className="oc-login-hint">Use your @virginia.edu email address.</p>
      </div>
      <div className="oc-login-field">
        <div className="oc-login-password-label"><Label htmlFor="login-password">Password</Label><Link href="/forgot-password" className="oc-login-text-link">Forgot password?</Link></div>
        <Input id="login-password" type="password" autoComplete="current-password" required disabled={busy} value={password} onChange={event => onPasswordChange(event.target.value)} aria-invalid={!!error} aria-describedby={error ? "auth-error" : undefined} />
      </div>
      <Button type="submit" disabled={busy || !password} className="oc-login-submit">{loading ? <><Loader2 className="size-4 animate-spin" />Signing in…</> : <>Sign in<ArrowRight className="size-4" /></>}</Button>
      <button type="button" disabled={busy || resendSeconds > 0} onClick={onRequestCode} className="oc-login-text-link oc-login-code-link">{resendSeconds > 0 ? `Use an email code in ${resendSeconds}s` : "Use an email code instead"}</button>
    </form>
  )
}
