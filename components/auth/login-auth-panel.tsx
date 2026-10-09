import { useRef, type FormEvent } from "react"
import { ArrowLeft, ArrowRight, ChevronDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmailLoginForm, type EmailLoginFormProps } from "./email-login-form"

/** The existing Microsoft mark, without an icon package or provider changes. */
function MicrosoftIcon() {
  return <svg viewBox="0 0 21 21" className="size-5" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" /></svg>
}

type LoginAuthPanelProps = EmailLoginFormProps & {
  step: "email" | "verify"
  emailExpanded: boolean
  code: string
  notice: string
  onToggleEmail: () => void
  onCodeChange: (value: string) => void
  onMicrosoftLogin: () => void
  onVerifyCode: (event: FormEvent) => void
  onDifferentEmail: () => void
  onBack: () => void
  onCreateAccount?: () => void
}

export function LoginAuthPanel(props: LoginAuthPanelProps) {
  const { step, emailExpanded, email, code, notice, error, loading, microsoftLoading, resendSeconds, onToggleEmail, onCodeChange, onMicrosoftLogin, onVerifyCode, onRequestCode, onDifferentEmail, onBack, onCreateAccount } = props
  const emailToggle = useRef<HTMLButtonElement>(null)
  return (
    <main className="oc-login-auth" aria-labelledby="login-auth-title">
      <nav className="oc-login-nav" aria-label="Return navigation"><button type="button" onClick={onBack} className="oc-login-back"><ArrowLeft size={15} />Back to home</button></nav>
      <div className="oc-login-auth-content">
        <h2 id="login-auth-title">{step === "email" ? "Welcome back." : "Check your inbox."}</h2>
        <p className="oc-login-auth-description">{step === "email" ? "Sign in to OutClass." : <>Enter the six-digit code for <strong>{email}</strong>.</>}</p>
        {step === "email" ? (
          <>
            <Button type="button" disabled={microsoftLoading || loading} onClick={onMicrosoftLogin} aria-busy={microsoftLoading} className="oc-login-uva">{microsoftLoading ? <><Loader2 className="size-4 animate-spin" />Redirecting…</> : <><MicrosoftIcon />Continue with UVA</>}</Button>
            <button ref={emailToggle} type="button" disabled={loading || microsoftLoading} onClick={onToggleEmail} aria-expanded={emailExpanded} aria-controls="login-email-fields" className="oc-login-email-toggle">{emailExpanded ? "Hide email sign-in" : "Use email instead"}<ChevronDown size={14} /></button>
            <div id="login-email-fields" className="oc-login-email-reveal" data-expanded={emailExpanded} aria-hidden={!emailExpanded} inert={!emailExpanded} onKeyDown={event => {
              if (event.key === "Escape" && !loading && !microsoftLoading) { onToggleEmail(); emailToggle.current?.focus() }
            }}>
              <div className="oc-login-email-inner"><EmailLoginForm {...props} /></div>
            </div>
          </>
        ) : (
          <form onSubmit={onVerifyCode} className="oc-login-verify-form" aria-busy={loading}>
            <p role="status" className="oc-login-notice">{notice}</p>
            <div className="oc-login-field">
              <Label htmlFor="verification-code">Verification code</Label>
              <Input key="code" id="verification-code" autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={loading} value={code} onChange={event => onCodeChange(event.target.value)} aria-invalid={!!error} aria-describedby={error ? "auth-error" : undefined} placeholder="000000" className="oc-login-code-input" />
            </div>
            <Button type="submit" disabled={loading || code.length !== 6} className="oc-login-submit">{loading ? <><Loader2 className="size-4 animate-spin" />Verifying…</> : <>Verify and log in<ArrowRight className="size-4" /></>}</Button>
            <div className="oc-login-verify-actions"><button type="button" onClick={onRequestCode} disabled={loading || resendSeconds > 0} className="oc-login-text-link">{resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}</button><button type="button" disabled={loading} onClick={onDifferentEmail} className="oc-login-text-link">Use a different email</button></div>
          </form>
        )}
        {error && <p id="auth-error" role="alert" className="oc-login-error">{error}</p>}
        {onCreateAccount && <p className="oc-login-create">New to OutClass? <button type="button" onClick={onCreateAccount} className="oc-login-text-link">Create an account <ArrowRight size={14} /></button></p>}
      </div>
      <footer className="oc-login-footer"><p>For University of Virginia students and club leaders.</p></footer>
    </main>
  )
}
