"use client"

import { useState, type FormEvent } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { isUvaEmail } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
  if (memberName) return <section role="status" className="space-y-5 py-8 text-center font-sans text-neutral-950"><CheckCircle2 className="mx-auto size-12" /><h1 className="text-3xl font-semibold tracking-tight">You’re in!</h1><p className="text-sm text-neutral-500">Joined as <span className="font-medium text-black">{memberName}</span></p><div className="rounded-xl border border-neutral-200 bg-white p-5"><Loader2 className="mx-auto mb-3 size-5 animate-spin text-neutral-400" /><p className="font-medium">{connected ? "Waiting for proctor to start..." : "Reconnecting to the proctor..."}</p><p className="mt-2 text-sm leading-6 text-neutral-500">Keep this screen open. Your first ballot will appear automatically.</p></div></section>
  return <section className="space-y-6 font-sans text-neutral-950"><div><p className="text-xs uppercase tracking-widest text-neutral-500">Member check-in</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">Join live voting</h1><p className="mt-3 text-sm leading-6 text-neutral-500">Enter your UVA email and the PIN on the proctor’s screen.</p></div>
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="space-y-2"><Label htmlFor="join-email">UVA email</Label><Input id="join-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={event => { setEmail(event.target.value); setValidation("") }} placeholder="computingid@virginia.edu" className="h-12 bg-white shadow-none" required /></div>
      <div className="space-y-2"><Label htmlFor="join-pin">Session PIN</Label><Input id="join-pin" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" maxLength={6} value={pin} onChange={event => { setPin(event.target.value.replace(/\D/g, "")); setValidation("") }} placeholder="000000" className="h-14 bg-white text-center text-2xl tracking-[0.3em] shadow-none" required /></div>
      {(validation || error) && <p role="alert" className="text-sm text-rose-700">{validation || error}</p>}
      <Button type="submit" disabled={pending} className="h-12 w-full bg-black text-white shadow-none hover:bg-neutral-800">{pending ? <><Loader2 className="size-4 animate-spin" />Joining…</> : "Join demo session"}</Button>
    </form>
    <p className="text-xs leading-5 text-neutral-500">Demo only: email + PIN checks the sample roster; it does not verify email ownership. Try <button type="button" onClick={() => setEmail("pn4gk@virginia.edu")} className="text-black underline">pn4gk@virginia.edu (Priya)</button>. Verified sign-in and club membership must be supplied by the production auth service.</p>
  </section>
}
