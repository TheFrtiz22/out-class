"use client"

import { useState, type FormEvent } from "react"
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
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const input = schoolRequestSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)))
    if (!input.success) { setError(input.error.issues[0]?.message || "Check your details."); return }
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/school-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.data) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Your request could not be saved.")
      setConfirmation(data.message)
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to submit. Please try again.") }
    finally { setBusy(false) }
  }
  if (confirmation) return <div role="status" className="max-w-2xl space-y-4 rounded-2xl border bg-background p-6 sm:p-8"><h2>Thank you for bringing your school to us.</h2><p className="leading-7 text-muted-foreground">{confirmation}</p><Button variant="outline" asChild><Link href="/" prefetch={false}>Back to OutClass</Link></Button></div>
  return <form onSubmit={submit} className="max-w-2xl space-y-6 rounded-2xl border bg-background p-6 sm:p-8" aria-describedby="request-contact-note" aria-busy={busy}>
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="space-y-2"><span className="block text-sm">Your name</span><Input name="fullName" autoComplete="name" required minLength={2} maxLength={120} /></label>
      <label className="space-y-2"><span className="block text-sm">Email address</span><Input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
    </div>
    <label className="block space-y-2"><span className="block text-sm">University or college</span><Input name="university" required minLength={2} maxLength={200} /></label>
    <label className="block space-y-2"><span className="block text-sm">Your role</span><NativeSelect name="role" required className="w-full" defaultValue=""><option value="" disabled>Select your role</option>{schoolRequestRoles.map(role => <option key={role} value={role}>{schoolRequestRoleLabels[role]}</option>)}</NativeSelect></label>
    <label className="block space-y-2"><span className="block text-sm">Club, department, or organization <span className="text-muted-foreground">(optional)</span></span><Input name="organization" maxLength={200} autoComplete="organization" /></label>
    <label className="block space-y-2"><span className="block text-sm">What would you like OutClass to help with? <span className="text-muted-foreground">(optional)</span></span><Textarea name="message" maxLength={2000} rows={4} /></label>
    <div hidden aria-hidden="true"><label>Website<Input name="website" tabIndex={-1} autoComplete="off" maxLength={200} /></label></div>
    <p id="request-contact-note" className="text-sm leading-6 text-muted-foreground">Your contact details will be shared with OutClass administrators to review your request and follow up. A request does not approve your university or create an account.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit school request"}</Button>
  </form>
}
