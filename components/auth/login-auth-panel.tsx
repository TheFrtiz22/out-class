import { useRef, type FormEvent } from "react"
import { ArrowLeft, ArrowRight, ChevronDown } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmailLoginForm, type EmailLoginFormProps } from "./email-login-form"
import { MICROSOFT_AUTH_ENABLED } from "@/lib/auth-features"
import Image from "next/image"

/** The existing Microsoft mark, without an icon package or provider changes. */
function MicrosoftIcon() {
  return <Image src="/brand/third-party/microsoft.svg" alt="" aria-hidden="true" width={20} height={20} className="size-5" />
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
      <nav className="oc-login-nav" aria-label="Return navigation"><Button type="button" variant="ghost" size="sm" onClick={onBack} className="min-h-11 text-xs text-muted-foreground"><ArrowLeft size={15} />Back to home</Button></nav>
      <div className="oc-login-auth-content">
        <h2 id="login-auth-title">{step === "email" ? "Welcome back." : "Check your inbox."}</h2>
        <p className="oc-login-auth-description">{step === "email" ? "Sign in to OutClass." : <>Enter the six-digit code for <strong>{email}</strong>.</>}</p>
        {step === "email" ? (
          <>
            {MICROSOFT_AUTH_ENABLED && <>
              <Button type="button" disabled={microsoftLoading || loading} onClick={onMicrosoftLogin} loading={microsoftLoading} className="oc-login-uva"><MicrosoftIcon />Continue with UVA</Button>
              <Button ref={emailToggle} type="button" variant="ghost" disabled={loading || microsoftLoading} onClick={onToggleEmail} aria-expanded={emailExpanded} aria-controls="login-email-fields" className="oc-login-email-toggle">{emailExpanded ? "Hide email sign-in" : "Use email instead"}<ChevronDown size={14} /></Button>
              <div id="login-email-fields" className="oc-login-email-reveal" data-expanded={emailExpanded} aria-hidden={!emailExpanded} inert={!emailExpanded}>
                <div role="presentation" className="oc-login-email-inner" onKeyDown={event => { if (event.key === "Escape" && !loading && !microsoftLoading) { onToggleEmail(); emailToggle.current?.focus() } }}><EmailLoginForm {...props} /></div>
              </div>
            </>}
            {!MICROSOFT_AUTH_ENABLED && <EmailLoginForm {...props} />}
          </>
        ) : (
          <form onSubmit={onVerifyCode} className="oc-login-verify-form" aria-busy={loading}>
            <p role="status" className="oc-login-notice">{notice}</p>
            <div className="oc-login-field">
              <Label htmlFor="verification-code">Verification code</Label>
              {/* eslint-disable-next-line jsx-a11y/no-autofocus -- The request-code action opens this step; focus starts at the labelled OTP field. */}
              <Input key="code" id="verification-code" autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={loading} value={code} onChange={event => onCodeChange(event.target.value)} aria-invalid={!!error} aria-describedby={error ? "auth-error" : undefined} placeholder="000000" className="oc-login-code-input" />
            </div>
            <Button type="submit" disabled={loading || code.length !== 6} loading={loading} className="oc-login-submit">Verify and log in<ArrowRight className="size-4" /></Button>
            <div className="oc-login-verify-actions"><Button type="button" variant="link" className="h-auto min-h-11 px-0 text-xs" onClick={onRequestCode} disabled={loading || resendSeconds > 0}>{resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend code"}</Button><Button type="button" variant="link" className="h-auto min-h-11 px-0 text-xs" disabled={loading} onClick={onDifferentEmail}>Use a different email</Button></div>
          </form>
        )}
        {error && <p id="auth-error" role="alert" className="oc-login-error">{error}</p>}
        {onCreateAccount && <p className="oc-login-create">New to OutClass? <Button type="button" variant="link" onClick={onCreateAccount} className="h-auto min-h-11 gap-1.5 px-0 text-xs font-bold">Create an account <ArrowRight size={14} /></Button></p>}
      </div>
      <footer className="oc-login-footer"><p>For University of Virginia students and club leaders.</p></footer>
    </main>
  )
}
