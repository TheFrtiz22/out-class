"use client"

import { useEffect, useState } from "react"
import { Check, CalendarDays } from "lucide-react"
import { useApplicationState } from "@/lib/application-state"
import { currentStudent } from "@/lib/data"
import { recordDemoAttendance, type LeadStudent } from "@/lib/attendance"
import { AuthView } from "@/components/views/auth-view"
import { Button } from "@/components/ui/button"

export function CheckInSuccess({ eventName, clubId }: { eventName: string; clubId: string }) {
  return <div role="status" className="space-y-6 text-center">
    <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50"><Check className="size-7" /></div>
    <div><p className="mb-3 text-xs font-medium uppercase tracking-widest text-neutral-500">Attendance confirmed</p><h1 className="text-3xl font-semibold tracking-tight">You’re checked in for {eventName}!</h1></div>
    <p className="text-sm leading-6 text-neutral-500">Your interest has been shared with the club. You can explore their profile and apply whenever you’re ready.</p>
    <a href={`/club/${encodeURIComponent(clubId)}/`} className="block rounded-lg bg-black px-5 py-3 text-sm font-medium text-white">Explore the club</a>
  </div>
}

export function StudentCheckIn() {
  const { managedEvents, hydrated } = useApplicationState()
  const [eventId, setEventId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [student, setStudent] = useState<LeadStudent | null>(null)
  const [auth, setAuth] = useState(false)
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle")
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setEventId(new URLSearchParams(window.location.search).get("eventId"))
    try { if (sessionStorage.getItem("outclass-demo-student") === "true") setStudent({ ...currentStudent, id: currentStudent.email }) } catch { /* Allow explicit demo entry. */ }
    setReady(true)
  }, [])
  const event = managedEvents.find(item => item.id === eventId && item.scope === "Public" && !item.recurring)
  useEffect(() => {
    if (!hydrated || !event || !student) return
    setStatus("saving")
    try { recordDemoAttendance(student, event.clubId!, event.id); setStatus("success") } catch { setStatus("error") }
  }, [hydrated, event, student, attempt])
  if (auth && event) return <AuthView initialRole="student" onBack={() => setAuth(false)} onEnter={() => {
    try { sessionStorage.setItem("outclass-demo-student", "true") } catch { /* Check-in can still run. */ }
    setStudent({ ...currentStudent, id: currentStudent.email }); setAuth(false)
  }} />
  return <main className="flex min-h-svh items-center justify-center bg-neutral-50 px-5 py-10 font-sans text-black">
    <section className="w-full max-w-md space-y-6 rounded-2xl border border-neutral-200 bg-white p-7 shadow-none">
      <p className="text-sm font-semibold tracking-tight">OutClass</p>
      {!ready || !hydrated ? <p role="status">Loading event…</p> : !event ? <><h1 className="text-2xl font-semibold">Check-in unavailable</h1><p className="text-sm text-neutral-500">This event may have been removed or isn’t available in this browser. Ask the club leader for a current link.</p><a href="/" className="text-sm underline">Back to OutClass</a></> : status === "success" ? <CheckInSuccess eventName={event.title} clubId={event.clubId!} /> : <>
        <CalendarDays className="size-8" /><h1 className="text-2xl font-semibold">Check in to {event.title}</h1>
        <p className="text-sm text-neutral-500">{event.date} · {event.time}<br />{event.location}</p>
        {status === "error" ? <><p role="alert" className="text-sm text-red-700">Your check-in could not be saved. Enable browser storage and try again.</p><Button onClick={() => setAttempt(value => value + 1)}>Retry check-in</Button></> : student ? <p role="status">Saving your attendance…</p> : <><p className="text-sm leading-6 text-neutral-500">Sign in or create your OutClass profile to confirm attendance and share your interest with the club. This does not start an application.</p><Button className="w-full bg-black text-white" onClick={() => setAuth(true)}>Sign in or create profile</Button></>}
      </>}
      <p className="border-t border-neutral-200 pt-4 text-xs leading-5 text-neutral-500">Preview only. “Explore the demo” uses Jordan Avery’s sample profile and saves attendance in this browser. Live sign-in and cross-device attendance are not connected.</p>
    </section>
  </main>
}
