"use client"
import { userMessage } from "@/lib/user-message"

import Link from "next/link"
import dynamic from "next/dynamic"
import { authEmailError, confirmedEmailSession } from "@/lib/auth-email"
import { passwordNotSavedNotice, setPasswordAfterConfirmation } from "@/lib/signup-password"
import { PASSWORD_HINT } from "@/lib/password-policy"
import { InvitationProfileSuggestions } from "@/components/invitation-profile-suggestions"
import type { InvitationProfileDefaults } from "@/lib/organization-claiming"
import { useAuth } from "@/contexts/auth-context"
import { useState, useRef, useCallback, useEffect, type DragEvent } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowRight,
  ArrowLeft,
  Mail,
  ShieldCheck,
  GraduationCap,
  Briefcase,
  Upload,
  FileText,
  X,
  Check,
  Compass,
} from "@/components/icons"

import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OutClassLogo } from "@/components/outclass-logo"
import { createClient } from "@/utils/supabase/client"
import { registerStudent } from "@/actions/onboarding"
import { acceptCurrentTerms } from "@/actions/terms"
import { TermsClickwrap, clickwrapAnswer, saveClickwrapAcceptance, TERMS_SAVE_FAILED } from "@/components/legal/terms-clickwrap"
import { TERMS_ACCEPTANCE_REQUIRED, TERMS_REQUIRED_MESSAGE } from "@/lib/legal-versions"
import { TurnstileWidget } from "@/components/security/turnstile-widget"
import { captchaFailed, turnstileMessage, turnstileRequired, TURNSTILE_PENDING, withCaptcha } from "@/lib/turnstile"
import { upsertStudentProfile } from "@/actions/profile"
import { dismissInterestSurveyPrompt } from "@/lib/workspace-api"
import { invalidateInterestSurvey } from "@/hooks/use-interest-survey"
import { uploadProfileFile } from "@/actions/storage"
import {
  accountBasicsSchema,
  registrationSchema,
  otpVerifySchema,
  academicProfileSchema,
  experienceAssetsSchema,
  type AccountBasicsData,
  type OtpVerifyData,
  type AcademicProfileData,
  type ExperienceAssetsData,
  type WizardData,
} from "@/lib/onboarding-schemas"
import { Panel } from "@/components/ui/panel"

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Account", icon: ShieldCheck },
  { label: "Verify", icon: Mail },
  { label: "Academic", icon: GraduationCap },
  { label: "Experience", icon: Briefcase },
  { label: "Interests", icon: Compass },
] as const

const GRAD_YEARS = ["2025", "2026", "2027", "2028", "2029", "2030"]

// Steps 2 and 3 widgets load in their own chunks (server-rendered when visible). The wizard starts
// both downloads after mount, and each placeholder matches the control's height, so a later step
// does not shift or flash.
const loadVerificationCodeInput = () => import("@/components/onboarding/verification-code-input")
const loadGraduationYearSelect = () => import("@/components/onboarding/graduation-year-select")
const VerificationCodeInput = dynamic(() => loadVerificationCodeInput().then(module => module.VerificationCodeInput), { loading: () => <div aria-hidden="true" className="h-12 w-[calc(6*clamp(28px,8vw,48px))]" /> })
const GraduationYearSelect = dynamic(() => loadGraduationYearSelect().then(module => module.GraduationYearSelect), { loading: () => <div aria-hidden="true" className="h-11 w-full rounded-md border border-border" /> })
// The optional interest survey (last step) loads in its own chunk once the profile is saved.
const loadInterestSurveyForm = () => import("@/components/interests/interest-survey-form")
const InterestSurveyForm = dynamic(() => loadInterestSurveyForm().then(module => module.InterestSurveyForm), { loading: () => <div aria-hidden="true" className="h-72 w-full" /> })
const MAX_RESUME_SIZE = 10 * 1024 * 1024 // 10 MB

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function StepProgress({ current }: { current: number }) {
  return (
    <div className="mb-8">
      {/* Step counter text */}
      <p className="mb-3 text-center text-xs font-medium text-muted-foreground">
        Step {current} of {STEPS.length}
      </p>

      {/* Segmented progress bar */}
      <div className="flex gap-1.5">
        {STEPS.map((step, i) => (
          <div key={step.label} className="flex-1">
            <div
              className={`h-1.5 rounded-full transition-colors duration-300 ${
                i + 1 <= current ? "bg-primary" : "bg-secondary"
              }`}
            />
          </div>
        ))}
      </div>

      {/* Step labels */}
      <div className="mt-2 flex">
        {STEPS.map((step, i) => {
          const Icon = step.icon
          return (
            <div
              key={step.label}
              className={`flex flex-1 items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
                i + 1 <= current ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {i + 1 < current ? (
                <Check className="size-3.5" />
              ) : (
                <Icon className="size-3.5" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Resume Drop Zone ─────────────────────────────────────────────────────────

function ResumeDropZone({
  file,
  onFile,
  onRemove,
}: {
  file: File | null
  onFile: (f: File) => void
  onRemove: () => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped && dropped.type === "application/pdf") onFile(dropped)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (selected) onFile(selected)
  }

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-border bg-muted p-3">
        <FileText className="size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {file.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {(file.size / 1024).toFixed(0)} KB
          </p>
        </div>
        <IconButton
          size="icon-lg"
          onClick={onRemove}
          aria-label="Remove résumé"
        >
          <X className="size-4" />
        </IconButton>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Drag & drop your resume here, or press Enter to upload. PDF up to 10 MB."
      onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inputRef.current?.click() } }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-8 text-center transition-colors ${
        dragOver
          ? "border-primary bg-primary/5"
          : "border-border bg-muted hover:border-border"
      }`}
    >
      <Upload
        className={`size-6 ${dragOver ? "text-primary" : "text-muted-foreground"}`}
      />
      <p className="text-sm font-medium text-foreground">
        Drag & drop your resume here
      </p>
      <p className="text-xs text-muted-foreground">PDF only, up to 10 MB</p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export function StudentOnboardingWizard({
  onComplete, embedded = false, initialUser, onBack, onSignIn, termsAccepted = false,
}: {
  onComplete: () => void
  embedded?: boolean
  initialUser?: { email?: string; email_confirmed_at?: string | null; user_metadata?: Record<string, any> } | null
  onBack?: () => void
  onSignIn?: () => void
  /** The signed-in account already accepted the current Terms and Privacy versions (server check). */
  termsAccepted?: boolean
}) {
  const { isImpersonating } = useAuth()
  // Clickwrap: unticked until the person ticks it; asked once, on the account step.
  const askTerms = TERMS_ACCEPTANCE_REQUIRED && !termsAccepted
  const [acceptTerms, setAcceptTerms] = useState(false)
  // Set when the post-verification save failed: step 3 shows the box again and saves before moving on.
  const [termsUnsaved, setTermsUnsaved] = useState(false)
  const [step, setStep] = useState(1)
  // Warm the later steps' chunks while the visitor fills in step 1.
  useEffect(() => { void loadVerificationCodeInput(); void loadGraduationYearSelect() }, [])
  const [globalError, setGlobalError] = useState("")
  const [loading, setLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null), [turnstileReset, setTurnstileReset] = useState(0)
  const [codeSent, setCodeSent] = useState(false)
  const [accountCreated, setAccountCreated] = useState(!!initialUser?.email_confirmed_at)
  const [resendSeconds, setResendSeconds] = useState(0)
  const [notice, setNotice] = useState("")
  useEffect(() => {
    if (resendSeconds <= 0) return
    const timer = setTimeout(() => setResendSeconds(value => Math.max(0, value - 1)), 1000)
    return () => clearTimeout(timer)
  }, [resendSeconds])
  const [resumeFile, setResumeFile] = useState<File | null>(null)

  // Accumulated wizard data persisted across step changes
  const wizardData = useRef<WizardData>({
    accountBasics: null,
    academic: null,
    experience: null,
    resumeUrl: null,
  })

  const supabase = createClient()
  // Held only until the email code is verified, then cleared.
  const pendingPassword = useRef<string | undefined>(undefined)
  useEffect(() => () => { pendingPassword.current = undefined }, [])
  const [confirmNotice, setConfirmNotice] = useState("")

  // ── Step 1: Account Basics ────────────────────────────────────────────────

  const step1Form = useForm<AccountBasicsData & { password?: string }>({
    resolver: zodResolver(accountCreated ? accountBasicsSchema : registrationSchema),
    defaultValues: { firstName: initialUser?.user_metadata?.first_name ?? "", lastName: initialUser?.user_metadata?.last_name ?? "", email: initialUser?.email ?? "", password: "" },
  })

  async function onStep1Submit(data: AccountBasicsData) {
    if (isImpersonating || loading) return
    setGlobalError("")
    if (askTerms && !acceptTerms) { setGlobalError(TERMS_REQUIRED_MESSAGE); return }
    wizardData.current.accountBasics = { firstName: data.firstName, lastName: data.lastName, email: data.email }
    if (accountCreated) {
      // Signed in already (Microsoft or a confirmed email link): record the acceptance now.
      if (askTerms) {
        setLoading(true)
        try {
          const failed = await saveClickwrapAcceptance(acceptCurrentTerms)
          if (failed) { setGlobalError(failed); return }
        } finally { setLoading(false) }
      }
      setStep(3); return
    }
    if (turnstileRequired && !turnstileToken) { setGlobalError(TURNSTILE_PENDING); return }
    setLoading(true)
    try {
      const values = step1Form.getValues()
      const result = await registerStudent(values, turnstileToken, clickwrapAnswer(acceptTerms))
      if (result.error) { setGlobalError(result.error); return }
      pendingPassword.current = values.password
      setCodeSent(true)
      setResendSeconds(60)
      setNotice("")
      step2Form.reset()
      step1Form.setValue("password", "")
      setStep(2)
    } catch {
      setGlobalError("Unable to create your account. Please try again.")
    } finally { setLoading(false); setTurnstileReset(value => value + 1) /* tokens are single use */ }
  }

  // ── Step 2: OTP Verification ──────────────────────────────────────────────

  const step2Form = useForm<OtpVerifyData>({
    resolver: zodResolver(otpVerifySchema),
    defaultValues: { code: "" },
  })

  async function onStep2Submit(data: OtpVerifyData) {
    if (isImpersonating) { setGlobalError("Exit impersonation before changing authentication."); return }
    if (loading) return
    setGlobalError("")
    setLoading(true)
    try {
      const email = wizardData.current.accountBasics!.email
      const { data: verified, error } = await supabase.auth.verifyOtp({
        email,
        token: data.code,
        type: "email",
      })
      if (error) {
        setGlobalError(authEmailError(error, "verify"))
        return
      }
      const { data: current, error: identityError } = await supabase.auth.getUser()
      if (identityError || !confirmedEmailSession({ session: verified.session, user: current.user }, email)) {
        await supabase.auth.signOut()
        setGlobalError("Unable to confirm your email. Please verify again.")
        return
      }
      // The signup password was stored while the address was unconfirmed; set it again as the verified owner.
      const password = await setPasswordAfterConfirmation(supabase, pendingPassword.current)
      pendingPassword.current = undefined
      setConfirmNotice(password.saved ? "" : passwordNotSavedNotice)
      // The box was ticked on step 1 (registerStudent refused the account otherwise); now that the
      // account holder has a session, store it. If that fails, step 3 shows the box again and retries,
      // since the profile cannot be created without a stored acceptance.
      if (askTerms && acceptTerms && await saveClickwrapAcceptance(acceptCurrentTerms)) {
        setTermsUnsaved(true); setAcceptTerms(false); setGlobalError(TERMS_SAVE_FAILED)
      }
      setAccountCreated(true)
      step1Form.setValue("password", "")
      setStep(3)
    } catch {
      setGlobalError("Unable to verify this code. Check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  async function resendCode() {
    if (loading || resendSeconds > 0) return
    if (isImpersonating) { setGlobalError("Exit impersonation before changing authentication."); return }
    if (turnstileRequired && !turnstileToken) { setGlobalError(TURNSTILE_PENDING); return }
    setLoading(true)
    setGlobalError("")
    try {
      const { error } = await supabase.auth.resend(withCaptcha({ type: "signup" as const, email: wizardData.current.accountBasics!.email }, turnstileToken))
      if (captchaFailed(error)) setGlobalError(turnstileMessage("rejected"))
      else if (error) {
        setGlobalError(authEmailError(error, "send"))
        if (error.status === 429) setResendSeconds(60)
      } else { setNotice("Code sent"); setResendSeconds(60) }
    } catch { setGlobalError("Unable to resend the code. Please try again.") }
    finally { setLoading(false); setTurnstileReset(value => value + 1) }
  }

  // ── Step 3: Academic Profile ──────────────────────────────────────────────

  const step3Form = useForm<AcademicProfileData>({
    resolver: zodResolver(academicProfileSchema),
    defaultValues: { gradYear: "", major: "", gpa: "", satScore: "", actScore: "" },
  })

  function applyInvitationDefaults(defaults: InvitationProfileDefaults) {
    for (const field of ["firstName", "lastName"] as const) {
      if (!step1Form.getValues(field) && !step1Form.getFieldState(field).isDirty) {
        step1Form.setValue(field, defaults[field]);
      }
    }
    if (!step3Form.getValues("gradYear") && !step3Form.getFieldState("gradYear").isDirty) {
      step3Form.setValue("gradYear", defaults.gradYear);
    }
  }

  async function onStep3Submit(data: AcademicProfileData) {
    setConfirmNotice("")
    if (loading) return
    if (termsUnsaved) {
      if (!acceptTerms) { setGlobalError(TERMS_REQUIRED_MESSAGE); return }
      setLoading(true); setGlobalError("")
      try {
        const failed = await saveClickwrapAcceptance(acceptCurrentTerms)
        if (failed) { setGlobalError(failed); return }
        setTermsUnsaved(false)
      } finally { setLoading(false) }
    }
    setGlobalError("")
    wizardData.current.academic = data
    setStep(4)
  }

  // ── Step 4: Experience & Assets ───────────────────────────────────────────

  const step4Form = useForm<ExperienceAssetsData>({
    resolver: zodResolver(experienceAssetsSchema),
    defaultValues: { linkedinUrl: "", experiences: [] },
  })

  const experienceFields = useFieldArray({ control: step4Form.control, name: "experiences" })

  const handleResumeFile = useCallback((f: File) => {
    if (f.size > MAX_RESUME_SIZE) {
      setGlobalError("Resume must be under 10 MB")
      return
    }
    if (!["application/pdf", "application/octet-stream", ""].includes(f.type)) {
      setGlobalError("Only PDF files are accepted")
      return
    }
    setGlobalError("")
    setResumeFile(f)
  }, [])

  async function uploadResume(): Promise<string | null> {
    if (!resumeFile) return null
    const input = new FormData(); input.set("kind", "resume"); input.set("file", resumeFile)
    return (await uploadProfileFile(input)).reference
  }

  async function onStep4Submit(data: ExperienceAssetsData, skipAssets = false) {
    setGlobalError("")
    setLoading(true)
    try {
      wizardData.current.experience = data

      // Upload resume if one was attached
      const resumeUrl = skipAssets ? null : await uploadResume()
      wizardData.current.resumeUrl = resumeUrl

      // Derive computingId from email (part before @virginia.edu)
      const email = wizardData.current.accountBasics!.email
      const computingId = email.split("@")[0]

      // Commit the full profile
      const { accountBasics, academic } = wizardData.current
      await upsertStudentProfile({
        firstName: accountBasics!.firstName,
        lastName: accountBasics!.lastName,
        computingId,
        major: academic!.major,
        gradYear: parseInt(academic!.gradYear, 10),
        gpa: academic!.gpa ? parseFloat(academic!.gpa) : undefined,
        actScore: academic!.actScore ? Number(academic!.actScore) : undefined,
        satScore: academic!.satScore
          ? parseInt(academic!.satScore, 10)
          : undefined,
        linkedinUrl: data.linkedinUrl || "",
        experiences: data.experiences,
        resumeUrl: resumeUrl ?? undefined,
      })

      // Last, optional step: the club-interest survey.
      setStep(5)
    } catch (err) {
      setGlobalError(userMessage(err, "Couldn’t save your profile. Your answers are still here. Try again."))
    } finally {
      setLoading(false)
    }
  }

  // ── Step 5: Interests (optional, private to the student) ─────────────────

  useEffect(() => { if (step === 4) void loadInterestSurveyForm() }, [step])
  async function skipInterests() {
    setLoading(true)
    // Skipping also retires the one-time Home prompt; a failure here never blocks finishing.
    try { await dismissInterestSurveyPrompt() } catch { /* the Home prompt simply shows once */ }
    finally { invalidateInterestSurvey(); setLoading(false) }
    onComplete()
  }

  async function onSkipStep4() {
    // Submit with whatever data exists (no LinkedIn, no resume)
    await onStep4Submit({ linkedinUrl: "" }, true)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isImpersonating && !initialUser) return <p className="p-4">Account registration is unavailable during impersonation. <Link className="underline" href="/home">Open the user’s workspace</Link> to review their existing profile.</p>

  return (
    <div className={embedded ? "font-sans" : "flex min-h-svh items-center justify-center bg-background px-4 py-10 font-sans"}>
      <div className="mx-auto w-full max-w-[480px]">
        {onBack && <Button variant="ghost" onClick={onBack} disabled={loading} className="mb-4"><ArrowLeft className="size-4" />Back to home</Button>}
        {/* Logo */}
        {!embedded && <div className="mb-6 flex justify-center">
          <OutClassLogo variant="light" className="h-8 w-auto" />
        </div>}

        <InvitationProfileSuggestions enabled={accountCreated && !isImpersonating} onDefaults={applyInvitationDefaults} />

        {/* Card */}
        <Panel>
          <StepProgress current={step} />

          {/* Global error */}
          {globalError && (
            <div role="alert" className="oc-feedback mb-5">
              {globalError}
            </div>
          )}

          {/* ───── Step 1: Account Basics ───── */}
          {step === 1 && (
            <>
              <div className="mb-6">
                <h2 className="oc-section-heading text-foreground">
                  {accountCreated ? "Let’s finish your profile" : embedded ? "Your account" : "Create your account"}
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {accountCreated ? "Review your name below. We’ll help you complete your academics and optional experience next." : "Use your UVA email to get started."}
                </p>
              </div>

              <form
                onSubmit={step1Form.handleSubmit(onStep1Submit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      autoComplete="given-name"
                      placeholder="Jordan"
                      className="h-11 rounded-md border-border"
                      {...step1Form.register("firstName")}
                    />
                    {step1Form.formState.errors.firstName && (
                      <p className="text-control text-red-600">
                        {step1Form.formState.errors.firstName.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      autoComplete="family-name"
                      placeholder="Avery"
                      className="h-11 rounded-md border-border"
                      {...step1Form.register("lastName")}
                    />
                    {step1Form.formState.errors.lastName && (
                      <p className="text-control text-red-600">
                        {step1Form.formState.errors.lastName.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">UVA email address</Label>
                  <Input
                    id="email"
                    readOnly={accountCreated}
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="computingid@virginia.edu"
                    className="h-11 rounded-md border-border"
                    {...step1Form.register("email")}
                  />
                  <p className="text-xs text-muted-foreground">
                    {accountCreated ? "Your sign-in email is kept with your account. Invitations are matched using your verified university identity." : "Only @virginia.edu addresses are accepted."}
                  </p>
                  {step1Form.formState.errors.email && (
                    <p className="text-control text-red-600">
                      {step1Form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                {!accountCreated && <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" autoComplete="new-password" {...step1Form.register("password")} />
                  <p className="text-xs text-muted-foreground">{PASSWORD_HINT}</p>
                  {step1Form.formState.errors.password && <p className="text-control text-red-600">{step1Form.formState.errors.password.message}</p>}
                </div>}
                {askTerms && <TermsClickwrap checked={acceptTerms} onCheckedChange={value => { setAcceptTerms(value); if (value && globalError === TERMS_REQUIRED_MESSAGE) setGlobalError("") }} disabled={loading} />}
                {!accountCreated && <TurnstileWidget action="signup" onToken={setTurnstileToken} resetKey={turnstileReset} />}
                <Button
                  type="submit"
                  loading={loading}
                  disabled={loading}
                  className="mt-2 h-11 w-full rounded-md border border-primary bg-primary font-semibold text-white shadow-none hover:bg-primary/90"
                >
                  Continue <ArrowRight className="size-4" />
                </Button>
              </form>
            </>
          )}

          {/* ───── Step 2: Email Verification ───── */}
          {step === 2 && (
            <>
              <div className="mb-6">
                <h2 className="oc-section-heading text-foreground">
                  Verify your email
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  If this address can be registered, we’ll send a 6-digit code to{" "}
                  <strong className="break-all font-medium text-foreground">
                    {wizardData.current.accountBasics?.email}
                  </strong>. Already registered? Sign in below.
                </p>
              </div>

              {codeSent && <form
                onSubmit={step2Form.handleSubmit(onStep2Submit)}
                className="space-y-5"
              >
                <div className="flex justify-center">
                  <VerificationCodeInput
                    value={step2Form.watch("code")}
                    onChange={(value) =>
                      step2Form.setValue("code", value, {
                        shouldValidate: true,
                      })
                    }
                  />
                </div>
                {step2Form.formState.errors.code && (
                  <p className="text-center text-control text-red-600">
                    {step2Form.formState.errors.code.message}
                  </p>
                )}

                <Button
                  type="submit"
                  loading={loading}
                  disabled={loading || step2Form.watch("code").length !== 6}
                  className="h-11 w-full rounded-md border border-primary bg-primary font-semibold text-white shadow-none hover:bg-primary/90"
                >
                  Verify email <ArrowRight className="size-4" />
                </Button>

                {notice && <p role="status" className="text-center text-sm">{notice}</p>}
                <TurnstileWidget action="signup" onToken={setTurnstileToken} resetKey={turnstileReset} />
                <div className="flex justify-between text-xs">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={resendCode}
                    disabled={loading || resendSeconds > 0}
                    className="min-h-11 px-0 text-xs"
                  >
                    {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Didn’t receive it? Resend code"}
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    disabled={loading}
                    onClick={() => {
                      setStep(1)
                      setCodeSent(false)
                      pendingPassword.current = undefined
                      setNotice("")
                      step2Form.reset()
                      setGlobalError("")
                    }}
                    className="min-h-11 px-0 text-xs"
                  >
                    Use a different email
                  </Button>
                </div>
              </form>}
            </>
          )}

          {/* ───── Step 3: Academic Profile ───── */}
          {step === 3 && (
            <>
              <div className="mb-6">
                <h2 className="oc-section-heading text-foreground">
                  Academic profile
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Clubs use this to understand your background. GPA and test
                  scores are optional.
                </p>
                {confirmNotice && <p role="status" className="mt-3 text-sm text-muted-foreground">{confirmNotice}</p>}
              </div>

              <form
                onSubmit={step3Form.handleSubmit(onStep3Submit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="onboarding-grad-year">Graduation year</Label>
                    <GraduationYearSelect
                      years={GRAD_YEARS}
                      value={step3Form.watch("gradYear")}
                      onValueChange={(v) =>
                        step3Form.setValue("gradYear", v, {
                          shouldValidate: true,
                        })
                      }
                    />
                    {step3Form.formState.errors.gradYear && (
                      <p className="text-control text-red-600">
                        {step3Form.formState.errors.gradYear.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="major">Major</Label>
                    <Input
                      id="major"
                      placeholder="e.g. Computer Science"
                      className="h-11 rounded-md border-border"
                      {...step3Form.register("major")}
                    />
                    {step3Form.formState.errors.major && (
                      <p className="text-control text-red-600">
                        {step3Form.formState.errors.major.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="gpa">
                      GPA out of 4.0{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="gpa"
                      type="text"
                      inputMode="decimal"
                      placeholder="3.85"
                      className="h-11 rounded-md border-border"
                      {...step3Form.register("gpa")}
                    />
                    {step3Form.formState.errors.gpa && (
                      <p className="text-control text-red-600">
                        {step3Form.formState.errors.gpa.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="actScore">ACT composite (optional)</Label>
                    <Input id="actScore" type="number" min={1} max={36} step={1} {...step3Form.register("actScore")} />
                    {step3Form.formState.errors.actScore && <p role="alert" className="text-control text-red-600">{step3Form.formState.errors.actScore.message}</p>}
                    <Label htmlFor="satScore">
                      SAT score{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="satScore"
                      type="text"
                      inputMode="numeric"
                      placeholder="1520"
                      className="h-11 rounded-md border-border"
                      {...step3Form.register("satScore")}
                    />
                    {step3Form.formState.errors.satScore && (
                      <p className="text-control text-red-600">
                        {step3Form.formState.errors.satScore.message}
                      </p>
                    )}
                  </div>
                </div>

                {termsUnsaved && <TermsClickwrap id="accept-terms-retry" checked={acceptTerms} onCheckedChange={value => { setAcceptTerms(value); if (value && (globalError === TERMS_REQUIRED_MESSAGE || globalError === TERMS_SAVE_FAILED)) setGlobalError("") }} disabled={loading} />}

                <Button
                  type="submit"
                  disabled={loading}
                  className="mt-2 h-11 w-full rounded-md border border-primary bg-primary font-semibold text-white shadow-none hover:bg-primary/90"
                >
                  Continue
                  <ArrowRight className="size-4" />
                </Button>
              </form>
            </>
          )}

          {/* ───── Step 4: Experience & Assets ───── */}
          {step === 4 && (
            <>
              <div className="mb-6">
                <h2 className="oc-section-heading text-foreground">
                  Experience & assets
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Add your LinkedIn and resume to strengthen your profile. Both
                  are optional, and you can add them later.
                </p>
              </div>

              <form
                onSubmit={step4Form.handleSubmit((data) => onStep4Submit(data))}
                className="space-y-5"
              >

                <div className="space-y-3">
                  <p className="text-sm font-medium">Experience (optional)</p>
                  {experienceFields.fields.map((field, index) => <div key={field.id} className="space-y-2 rounded-lg border p-3">
                    <Input aria-label={`Experience ${index + 1} role`} placeholder="Role or title" {...step4Form.register(`experiences.${index}.title`)} />
                    <Input aria-label={`Experience ${index + 1} organization`} placeholder="Club, employer, or organization" {...step4Form.register(`experiences.${index}.subtitle`)} />
                    <Input aria-label={`Experience ${index + 1} dates`} placeholder="e.g. 2025–present" {...step4Form.register(`experiences.${index}.period`)} />
                    {step4Form.formState.errors.experiences?.[index] && <p className="text-control text-red-600">Add a title, organization, and dates, or remove this experience.</p>}
                    <Button type="button" variant="ghost" onClick={() => experienceFields.remove(index)}>Remove experience</Button>
                  </div>)}
                  <Button type="button" variant="outline" disabled={experienceFields.fields.length >= 20} onClick={() => experienceFields.append({ title: "", subtitle: "", period: "" })}>Add experience</Button>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="linkedinUrl">
                    LinkedIn profile{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="linkedinUrl"
                    type="text" inputMode="url"
                    placeholder="https://linkedin.com/in/your-profile"
                    className="h-11 rounded-md border-border"
                    {...step4Form.register("linkedinUrl")}
                  />
                  {step4Form.formState.errors.linkedinUrl && (
                    <p className="text-control text-red-600">
                      {step4Form.formState.errors.linkedinUrl.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>
                    Resume{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <ResumeDropZone
                    file={resumeFile}
                    onFile={handleResumeFile}
                    onRemove={() => setResumeFile(null)}
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <Button
                    type="button"
                    onClick={onSkipStep4}
                    disabled={loading}
                    variant="secondary"
                    className="h-11 flex-1 rounded-md border border-border bg-white font-medium text-foreground shadow-none hover:bg-muted"
                  >
                    Skip for now
                  </Button>
                  <Button
                    type="submit"
                    loading={loading}
                    disabled={loading}
                    className="h-11 flex-1 rounded-md border border-primary bg-primary font-semibold text-white shadow-none hover:bg-primary/90"
                  >
                    Continue <ArrowRight className="size-4" />
                  </Button>
                </div>
              </form>
            </>
          )}
          {/* ───── Step 5: Interests ───── */}
          {step === 5 && (
            <>
              <div className="mb-6">
                <h2 className="oc-section-heading text-foreground">Help us suggest clubs</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">About a minute. Optional.</p>
              </div>
              <InterestSurveyForm initial={null} idPrefix="onboarding-interests" submitLabel="Finish"
                onSaved={() => { invalidateInterestSurvey(); onComplete() }}
                secondary={busy => <Button type="button" variant="secondary" disabled={busy || loading} onClick={() => void skipInterests()}>Skip for now</Button>} />
            </>
          )}
        </Panel>

        {step === 4 && <Button variant="ghost" disabled={loading} onClick={() => setStep(3)} className="mt-3"><ArrowLeft className="size-4" />Back to academics</Button>}
        {onSignIn && <p className="mt-5 text-center text-sm text-muted-foreground">Already have an account? <Button type="button" variant="link" disabled={loading} onClick={onSignIn} className="min-h-11 px-1 font-semibold">Sign in</Button></p>}
        {/* Footer */}
        <p className="mt-5 text-center text-xs text-muted-foreground">
          For University of Virginia students and club leaders.
        </p>
      </div>
    </div>
  )
}
