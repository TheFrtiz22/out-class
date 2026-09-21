"use client"

import { useState, useRef, useCallback, type DragEvent } from "react"
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
  Loader2,
  Check,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { OutClassLogo } from "@/components/outclass-logo"
import { createClient } from "@/utils/supabase/client"
import { registerStudent } from "@/actions/onboarding"
import { Textarea } from "@/components/ui/textarea"
import { upsertStudentProfile } from "@/actions/profile"
import { getSignedUploadUrl } from "@/actions/storage"
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

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { label: "Account", icon: ShieldCheck },
  { label: "Verify", icon: Mail },
  { label: "Academic", icon: GraduationCap },
  { label: "Experience", icon: Briefcase },
] as const

const GRAD_YEARS = ["2025", "2026", "2027", "2028", "2029", "2030"]
const MAX_RESUME_SIZE = 5 * 1024 * 1024 // 5 MB

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function StepProgress({ current }: { current: number }) {
  return (
    <div className="mb-8">
      {/* Step counter text */}
      <p className="mb-3 text-center text-xs font-medium text-neutral-500">
        Step {current} of {STEPS.length}
      </p>

      {/* Segmented progress bar */}
      <div className="flex gap-1.5">
        {STEPS.map((step, i) => (
          <div key={step.label} className="flex-1">
            <div
              className={`h-1.5 rounded-full transition-colors duration-300 ${
                i + 1 <= current ? "bg-primary" : "bg-neutral-200"
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
                i + 1 <= current ? "text-primary" : "text-neutral-400"
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
      <div className="flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
        <FileText className="size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-900">
            {file.name}
          </p>
          <p className="text-xs text-neutral-500">
            {(file.size / 1024).toFixed(0)} KB
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div
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
          : "border-neutral-200 bg-neutral-50 hover:border-neutral-300"
      }`}
    >
      <Upload
        className={`size-8 ${dragOver ? "text-primary" : "text-neutral-400"}`}
      />
      <p className="text-sm font-medium text-neutral-700">
        Drag & drop your resume here
      </p>
      <p className="text-xs text-neutral-500">PDF only, up to 5 MB</p>
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
  onComplete, embedded = false, initialUser, onBack, onSignIn,
}: {
  onComplete: () => void
  embedded?: boolean
  initialUser?: { email?: string; user_metadata?: Record<string, any> } | null
  onBack?: () => void
  onSignIn?: () => void
}) {
  const [step, setStep] = useState(1)
  const [globalError, setGlobalError] = useState("")
  const [loading, setLoading] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [accountCreated, setAccountCreated] = useState(!!initialUser)
  const [resumeFile, setResumeFile] = useState<File | null>(null)

  // Accumulated wizard data persisted across step changes
  const wizardData = useRef<WizardData>({
    accountBasics: null,
    academic: null,
    experience: null,
    resumeUrl: null,
  })

  const supabase = createClient()

  // ── Step 1: Account Basics ────────────────────────────────────────────────

  const step1Form = useForm<AccountBasicsData & { password?: string }>({
    resolver: zodResolver(initialUser ? accountBasicsSchema : registrationSchema),
    defaultValues: { firstName: initialUser?.user_metadata?.first_name ?? "", lastName: initialUser?.user_metadata?.last_name ?? "", email: initialUser?.email ?? "", password: "" },
  })

  function onStep1Submit(data: AccountBasicsData) {
    setGlobalError("")
    wizardData.current.accountBasics = { firstName: data.firstName, lastName: data.lastName, email: data.email }
    setStep(accountCreated ? 3 : 2)
  }

  async function createAccount(skipVerification: boolean) {
    if (loading) return
    setLoading(true)
    setGlobalError("")
    try {
      const result = await registerStudent(step1Form.getValues(), skipVerification)
      if (result.error) { setGlobalError(result.error); return }
      if (result.authenticated) {
        setAccountCreated(true)
        step1Form.setValue("password", "")
        setStep(3)
      } else {
        setCodeSent(true)
      }
    } catch {
      setGlobalError("Unable to create your account. Please try again.")
    } finally { setLoading(false) }
  }

  // ── Step 2: OTP Verification ──────────────────────────────────────────────

  const step2Form = useForm<OtpVerifyData>({
    resolver: zodResolver(otpVerifySchema),
    defaultValues: { code: "" },
  })

  async function onStep2Submit(data: OtpVerifyData) {
    setGlobalError("")
    setLoading(true)
    try {
      const email = wizardData.current.accountBasics!.email
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: data.code,
        type: "email",
      })
      if (error) {
        setGlobalError(error.message)
        return
      }
      setAccountCreated(true)
      step1Form.setValue("password", "")
      setStep(3)
    } catch (err: any) {
      setGlobalError(err?.message ?? "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  async function resendCode() {
    setLoading(true)
    setGlobalError("")
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: wizardData.current.accountBasics!.email })
      if (error) setGlobalError(error.message)
    } catch { setGlobalError("Unable to resend the code. Please try again.") }
    finally { setLoading(false) }
  }

  // ── Step 3: Academic Profile ──────────────────────────────────────────────

  const step3Form = useForm<AcademicProfileData>({
    resolver: zodResolver(academicProfileSchema),
    defaultValues: { gradYear: "", major: "", gpa: "", satScore: "" },
  })

  function onStep3Submit(data: AcademicProfileData) {
    wizardData.current.academic = data
    setStep(4)
  }

  // ── Step 4: Experience & Assets ───────────────────────────────────────────

  const step4Form = useForm<ExperienceAssetsData>({
    resolver: zodResolver(experienceAssetsSchema),
    defaultValues: { linkedinUrl: "", bio: "", experiences: [] },
  })

  const experienceFields = useFieldArray({ control: step4Form.control, name: "experiences" })

  const handleResumeFile = useCallback((f: File) => {
    if (f.size > MAX_RESUME_SIZE) {
      setGlobalError("Resume must be under 5 MB")
      return
    }
    if (f.type !== "application/pdf") {
      setGlobalError("Only PDF files are accepted")
      return
    }
    setGlobalError("")
    setResumeFile(f)
  }, [])

  async function uploadResume(): Promise<string | null> {
    if (!resumeFile) return null
    const { signedUrl, publicUrl } = await getSignedUploadUrl({ fileName: resumeFile.name, bucket: "resumes" })
    const response = await fetch(signedUrl, { method: "PUT", body: resumeFile, headers: { "Content-Type": "application/pdf" } })
    if (!response.ok) throw new Error("Resume upload failed. Retry or remove the file to continue without it.")
    return publicUrl
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
        satScore: academic!.satScore
          ? parseInt(academic!.satScore, 10)
          : undefined,
        linkedinUrl: data.linkedinUrl || "",
        bio: data.bio,
        experiences: data.experiences,
        resumeUrl: resumeUrl ?? undefined,
      })

      // Navigate to the dashboard
      onComplete()
    } catch (err: any) {
      setGlobalError(err?.message ?? "Failed to save your profile")
    } finally {
      setLoading(false)
    }
  }

  async function onSkipStep4() {
    // Submit with whatever data exists (no LinkedIn, no resume)
    await onStep4Submit({ linkedinUrl: "" }, true)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={embedded ? "font-sans" : "flex min-h-svh items-center justify-center bg-neutral-50 px-4 py-10 font-sans"}>
      <div className="mx-auto w-full max-w-[480px]">
        {onBack && <Button variant="ghost" onClick={onBack} disabled={loading} className="mb-4"><ArrowLeft className="size-4" />Back to home</Button>}
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <OutClassLogo variant="light" className="h-8 w-auto" />
        </div>

        {/* Card */}
        <div className="rounded-xl border border-neutral-200 bg-white px-6 py-8 sm:px-8">
          <StepProgress current={step} />

          {/* Global error */}
          {globalError && (
            <div role="alert" className="mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {globalError}
            </div>
          )}

          {/* ───── Step 1: Account Basics ───── */}
          {step === 1 && (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
                  Create your account
                </h2>
                <p className="mt-1.5 text-sm text-neutral-500">
                  Use your UVA email to get started.
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
                      className="h-11 rounded-md border-neutral-200"
                      {...step1Form.register("firstName")}
                    />
                    {step1Form.formState.errors.firstName && (
                      <p className="text-xs text-red-600">
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
                      className="h-11 rounded-md border-neutral-200"
                      {...step1Form.register("lastName")}
                    />
                    {step1Form.formState.errors.lastName && (
                      <p className="text-xs text-red-600">
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
                    className="h-11 rounded-md border-neutral-200"
                    {...step1Form.register("email")}
                  />
                  <p className="text-xs text-neutral-500">
                    Only @virginia.edu addresses are accepted.
                  </p>
                  {step1Form.formState.errors.email && (
                    <p className="text-xs text-red-600">
                      {step1Form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                {!initialUser && <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" autoComplete="new-password" {...step1Form.register("password")} />
                  <p className="text-xs text-neutral-500">At least 8 characters. Use this password to sign in again.</p>
                  {step1Form.formState.errors.password && <p className="text-xs text-red-600">{step1Form.formState.errors.password.message}</p>}
                </div>}
                <Button
                  type="submit"
                  disabled={loading}
                  className="mt-2 h-11 w-full rounded-md border border-primary bg-primary font-semibold text-white shadow-none hover:bg-primary/90"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </form>
            </>
          )}

          {/* ───── Step 2: Email Verification ───── */}
          {step === 2 && (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
                  {codeSent ? "Check your inbox" : "Email verification"}
                </h2>
                <p className="mt-1.5 text-sm text-neutral-500">
                  {codeSent ? "Enter the verification code sent to " : "Create your account for "}
                  <strong className="break-all font-medium text-neutral-900">
                    {wizardData.current.accountBasics?.email}
                  </strong>
                </p>
              </div>

              {!codeSent && <div className="space-y-3">
                <p className="text-sm leading-6 text-neutral-500">Email delivery isn’t connected yet. Skip verification for now and sign in with your password.</p>
                <Button className="w-full" disabled={loading} onClick={() => createAccount(true)}>{loading ? <Loader2 className="size-4 animate-spin" /> : "Skip verification & create account"}</Button>
                <Button variant="outline" className="w-full" disabled={loading} onClick={() => createAccount(false)}>Send verification email</Button>
                <Button variant="ghost" className="w-full" disabled={loading} onClick={() => { setStep(1); setGlobalError("") }}>Edit account details</Button>
              </div>}
              {codeSent && <form
                onSubmit={step2Form.handleSubmit(onStep2Submit)}
                className="space-y-5"
              >
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={step2Form.watch("code")}
                    onChange={(value) =>
                      step2Form.setValue("code", value, {
                        shouldValidate: true,
                      })
                    }
                  >
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className="h-12 w-12 text-lg shadow-none"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {step2Form.formState.errors.code && (
                  <p className="text-center text-xs text-red-600">
                    {step2Form.formState.errors.code.message}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading || step2Form.watch("code").length !== 6}
                  className="h-11 w-full rounded-md border border-primary bg-primary font-semibold text-white shadow-none hover:bg-primary/90"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Verify & continue
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>

                <div className="flex justify-between text-xs">
                  <button
                    type="button"
                    onClick={resendCode}
                    disabled={loading}
                    className="font-medium text-neutral-600 hover:text-neutral-900"
                  >
                    Resend code
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1)
                      step2Form.reset()
                      setGlobalError("")
                    }}
                    className="font-medium text-neutral-600 hover:text-neutral-900"
                  >
                    Use a different email
                  </button>
                </div>
              </form>}
            </>
          )}

          {/* ───── Step 3: Academic Profile ───── */}
          {step === 3 && (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
                  Academic profile
                </h2>
                <p className="mt-1.5 text-sm text-neutral-500">
                  Clubs use this to understand your background. GPA and test
                  scores are optional.
                </p>
              </div>

              <form
                onSubmit={step3Form.handleSubmit(onStep3Submit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Graduation year</Label>
                    <Select
                      value={step3Form.watch("gradYear")}
                      onValueChange={(v) =>
                        step3Form.setValue("gradYear", v, {
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger className="h-11 w-full rounded-md border-neutral-200 shadow-none">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {GRAD_YEARS.map((y) => (
                          <SelectItem key={y} value={y}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {step3Form.formState.errors.gradYear && (
                      <p className="text-xs text-red-600">
                        {step3Form.formState.errors.gradYear.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="major">Major</Label>
                    <Input
                      id="major"
                      placeholder="e.g. Computer Science"
                      className="h-11 rounded-md border-neutral-200"
                      {...step3Form.register("major")}
                    />
                    {step3Form.formState.errors.major && (
                      <p className="text-xs text-red-600">
                        {step3Form.formState.errors.major.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="gpa">
                      GPA{" "}
                      <span className="font-normal text-neutral-400">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="gpa"
                      type="text"
                      inputMode="decimal"
                      placeholder="3.85"
                      className="h-11 rounded-md border-neutral-200"
                      {...step3Form.register("gpa")}
                    />
                    {step3Form.formState.errors.gpa && (
                      <p className="text-xs text-red-600">
                        {step3Form.formState.errors.gpa.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="satScore">
                      SAT score{" "}
                      <span className="font-normal text-neutral-400">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="satScore"
                      type="text"
                      inputMode="numeric"
                      placeholder="1520"
                      className="h-11 rounded-md border-neutral-200"
                      {...step3Form.register("satScore")}
                    />
                    {step3Form.formState.errors.satScore && (
                      <p className="text-xs text-red-600">
                        {step3Form.formState.errors.satScore.message}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
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
                <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
                  Experience & assets
                </h2>
                <p className="mt-1.5 text-sm text-neutral-500">
                  Add your LinkedIn and resume to strengthen your profile. Both
                  are optional — you can always add them later.
                </p>
              </div>

              <form
                onSubmit={step4Form.handleSubmit((data) => onStep4Submit(data))}
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="bio">About you (optional)</Label>
                  <Textarea id="bio" maxLength={2000} placeholder="Your interests, goals, and what you bring to a club" {...step4Form.register("bio")} />
                </div>
                <div className="space-y-3">
                  <Label>Experience (optional)</Label>
                  {experienceFields.fields.map((field, index) => <div key={field.id} className="space-y-2 rounded-lg border p-3">
                    <Input aria-label={`Experience ${index + 1} role`} placeholder="Role or title" {...step4Form.register(`experiences.${index}.title`)} />
                    <Input aria-label={`Experience ${index + 1} organization`} placeholder="Club, employer, or organization" {...step4Form.register(`experiences.${index}.subtitle`)} />
                    <Input aria-label={`Experience ${index + 1} dates`} placeholder="e.g. 2025–present" {...step4Form.register(`experiences.${index}.period`)} />
                    {step4Form.formState.errors.experiences?.[index] && <p className="text-xs text-red-600">Add a title, organization, and dates, or remove this experience.</p>}
                    <Button type="button" variant="ghost" onClick={() => experienceFields.remove(index)}>Remove experience</Button>
                  </div>)}
                  <Button type="button" variant="outline" disabled={experienceFields.fields.length >= 20} onClick={() => experienceFields.append({ title: "", subtitle: "", period: "" })}>Add experience</Button>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="linkedinUrl">
                    LinkedIn profile{" "}
                    <span className="font-normal text-neutral-400">
                      — Optional / Skippable
                    </span>
                  </Label>
                  <Input
                    id="linkedinUrl"
                    type="url"
                    placeholder="https://linkedin.com/in/your-profile"
                    className="h-11 rounded-md border-neutral-200"
                    {...step4Form.register("linkedinUrl")}
                  />
                  {step4Form.formState.errors.linkedinUrl && (
                    <p className="text-xs text-red-600">
                      {step4Form.formState.errors.linkedinUrl.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>
                    Resume{" "}
                    <span className="font-normal text-neutral-400">
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
                    className="h-11 flex-1 rounded-md border border-neutral-300 bg-white font-medium text-neutral-900 shadow-none hover:bg-neutral-50"
                  >
                    Skip for now
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-11 flex-1 rounded-md border border-primary bg-primary font-semibold text-white shadow-none hover:bg-primary/90"
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        Finish
                        <Check className="size-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>

        {step === 4 && <Button variant="ghost" disabled={loading} onClick={() => setStep(3)} className="mt-3"><ArrowLeft className="size-4" />Back to academics</Button>}
        {onSignIn && <p className="mt-5 text-center text-sm text-neutral-600">Already have an account? <button type="button" disabled={loading} onClick={onSignIn} className="font-semibold text-primary underline">Sign in</button></p>}
        {/* Footer */}
        <p className="mt-5 text-center text-xs text-neutral-400">
          For University of Virginia students and club leaders.
        </p>
      </div>
    </div>
  )
}

