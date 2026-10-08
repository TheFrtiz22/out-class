"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { ArrowRight, Check, Loader2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { NativeSelect } from "@/components/ui/native-select"
import { schoolRequestSchema, schoolRequestRoles, schoolRequestRoleLabels } from "@/lib/school-requests"

export function SchoolRequestForm() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState<{ university: string; email: string } | null>(null)
  const form = useRef<HTMLFormElement>(null)
  const success = useRef<HTMLDivElement>(null)
  const errorSummary = useRef<HTMLDivElement>(null)
  useEffect(() => { if (confirmation) success.current?.focus() }, [confirmation])
  useEffect(() => { if (error) errorSummary.current?.focus() }, [error])
  const fieldProps = (name: string) => ({
    id: `request-${name}`, name,
    "aria-invalid": !!fieldErrors[name],
    "aria-describedby": fieldErrors[name] ? `request-${name}-error` : undefined,
    onChange: () => setFieldErrors(current => { const next = { ...current }; delete next[name]; return next }),
  })
  const fieldError = (name: string) => fieldErrors[name] && <p id={`request-${name}-error`} className="oc-request-field-error">{fieldErrors[name]}</p>
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const input = schoolRequestSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)))
    if (!input.success) {
      const errors: Record<string, string> = {}
      input.error.issues.forEach(issue => { const name = String(issue.path[0]); if (!errors[name]) errors[name] = issue.message })
      setFieldErrors(errors)
      setError("")
      const first = Object.keys(errors)[0]
      form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }
    setFieldErrors({})
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/school-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.data) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Your request could not be saved.")
      setSubmitted({ university: input.data.university, email: input.data.email })
      setConfirmation(data.message)
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to submit. Please try again.") }
    finally { setBusy(false) }
  }
  if (confirmation) return <div ref={success} tabIndex={-1} className="oc-request-success" aria-labelledby="request-success-title">
    <span className="oc-request-success-mark"><Check size={24} aria-hidden="true" /></span><p className="oc-public-kicker">A new campus conversation</p><h2 id="request-success-title">Your school is<br />on our radar.</h2><p className="oc-request-success-school">{submitted?.university}</p><p role="status">{confirmation}</p><p className="oc-public-note">Contact email: <span className="break-all">{submitted?.email}</span></p><div className="oc-public-actions"><Button variant="outline" asChild><Link href="/about" prefetch={false}>Explore the OutClass story <ArrowRight size={16} aria-hidden="true" /></Link></Button></div>
  </div>
  return <form ref={form} noValidate onSubmit={submit} className="oc-request-form" aria-labelledby="request-form-title" aria-describedby="request-contact-note" aria-busy={busy}>
    <div className="oc-request-form-heading"><p className="oc-public-kicker">Campus interest</p><h3 id="request-form-title">Tell us where you’d like to see OutClass.</h3><p>Four required details. The rest is up to you.</p></div>
    <fieldset disabled={busy} className="oc-request-fields"><legend className="sr-only">Your school and contact details</legend>
      <div className="oc-request-field"><label htmlFor="request-university">University or college</label><Input {...fieldProps("university")} required minLength={2} maxLength={200} placeholder="Your university’s name" />{fieldError("university")}</div>
      <div className="oc-request-field"><label htmlFor="request-role">Your role</label><NativeSelect {...fieldProps("role")} required defaultValue=""><option value="" disabled>Select your role</option>{schoolRequestRoles.map(role => <option key={role} value={role}>{schoolRequestRoleLabels[role]}</option>)}</NativeSelect>{fieldError("role")}</div>
      <div className="oc-request-field-pair"><div className="oc-request-field"><label htmlFor="request-fullName">Your name</label><Input {...fieldProps("fullName")} autoComplete="name" required minLength={2} maxLength={120} placeholder="Full name" />{fieldError("fullName")}</div><div className="oc-request-field"><label htmlFor="request-email">Email address</label><Input {...fieldProps("email")} type="email" autoComplete="email" required maxLength={254} placeholder="you@university.edu" />{fieldError("email")}</div></div>
      <div className="oc-request-field"><label htmlFor="request-organization">Club, department, or organization <span>(optional)</span></label><Input {...fieldProps("organization")} maxLength={200} autoComplete="organization" />{fieldError("organization")}</div>
      <div className="oc-request-field"><label htmlFor="request-message">What could OutClass help with? <span>(optional)</span></label><Textarea {...fieldProps("message")} maxLength={2000} rows={3} placeholder="A little about your campus or club…" />{fieldError("message")}</div>
      <div hidden aria-hidden="true"><label>Website<Input name="website" tabIndex={-1} autoComplete="off" maxLength={200} /></label></div>
    </fieldset>
    <p id="request-contact-note" className="text-sm leading-6 text-muted-foreground">Your contact details will be shared with OutClass administrators to review your request and follow up. A request does not approve your university or create an account.</p>
    {error && <div ref={errorSummary} tabIndex={-1} role="alert" className="oc-request-error"><p>{error}</p><span>Your details are still here. You can try again.</span></div>}
    <Button className="oc-request-submit" type="submit" disabled={busy}>{busy ? <><Loader2 className="motion-safe:animate-spin" size={16} aria-hidden="true" />Submitting…</> : <>Submit school request <ArrowRight size={16} aria-hidden="true" /></>}</Button>
    <p className="oc-public-note" role="status">{busy ? "Saving your school request…" : "No account needed. Just an interest in what’s next."}</p>
  </form>
}
