"use client"

import { useState, type FormEvent } from "react"
import { CheckCircle2, Clock3 } from "@/components/icons"
import { isUvaEmail } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/ui/page-header"
import { Panel } from "@/components/ui/panel"

export function MobileJoinScreen({ onJoin, pending = false, error = "", memberName, connected = true }: {
  onJoin: (email: string, pin: string) => void
  pending?: boolean
  error?: string
  memberName?: string
  connected?: boolean
}) {
  const [email, setEmail] = useState("")
  const [pin, setPin] = useState("")
  const [validation, setValidation] = useState("")
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!isUvaEmail(email)) { setValidation("Use your UVA email ending in @virginia.edu."); return }
    if (!/^\d{6}$/.test(pin)) { setValidation("Enter the six-digit Session PIN shown by the proctor."); return }
    setValidation(""); onJoin(email.trim().toLowerCase(), pin)
  }
  if (memberName) return <section role="status" className="space-y-5 py-8 text-center font-sans text-foreground"><CheckCircle2 className="mx-auto size-12" /><PageHeader title="You’re in!" /><p className="text-sm text-muted-foreground">Joined as <span className="font-medium text-black">{memberName}</span></p><Panel className="border-border"><Clock3 aria-hidden="true" className="mx-auto mb-3 size-5 text-muted-foreground" /><p className="font-medium">{connected ? "Waiting for proctor to start..." : "Reconnecting to the proctor..."}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Keep this screen open. Your first ballot will appear automatically.</p></Panel></section>
  return <section className="space-y-6 font-sans text-foreground"><div><p className="text-xs uppercase tracking-widest text-muted-foreground">Member check-in</p><PageHeader title="Join live voting" /><p className="mt-3 text-sm leading-6 text-muted-foreground">Enter your UVA email and the PIN on the proctor’s screen.</p></div>
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="space-y-2"><Label htmlFor="join-email">UVA email</Label><Input id="join-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={event => { setEmail(event.target.value); setValidation("") }} placeholder="computingid@virginia.edu" className="h-12 bg-white shadow-none" required /></div>
      <div className="space-y-2"><Label htmlFor="join-pin">Session PIN</Label><Input id="join-pin" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={event => { setPin(event.target.value.replace(/\D/g, "")); setValidation("") }} placeholder="000000" className="h-14 bg-white text-center text-2xl tracking-[0.3em] shadow-none" required /></div>
      {(validation || error) && <p role="alert" className="text-sm text-rose-700">{validation || error}</p>}
      <Button type="submit" disabled={pending} loading={pending} className="h-12 w-full bg-black text-white shadow-none hover:bg-black/80">Join demo session</Button>
    </form>
    <p className="text-xs leading-5 text-muted-foreground">Demo only: email + PIN checks the sample roster; it does not verify email ownership. Try <Button type="button" variant="link" onClick={() => setEmail("pn4gk@virginia.edu")} className="h-auto whitespace-normal p-0 align-baseline text-xs">pn4gk@virginia.edu (Priya)</Button>. Verified sign-in and club membership must be supplied by the production auth service.</p>
  </section>
}
