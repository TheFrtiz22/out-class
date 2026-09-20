"use client"

import { useEffect, useRef } from "react"
import { MobileJoinScreen } from "./mobile-join-screen"
import { Check, X, CheckCircle2, Radio, Loader2 } from "lucide-react"
import { useMemberSession } from "@/lib/use-live-voting"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function MemberVotingPad({ sessionId, embedded = false, initialJoin }: { sessionId: string; embedded?: boolean; initialJoin?: { email: string; pin: string } }) {
  const { session, memberId, connected, pending, joining, error, vote, join } = useMemberSession(sessionId, embedded ? "embedded-preview" : "member")
  const submitted = useRef(false)
  useEffect(() => {
    if (initialJoin && connected && !submitted.current) { submitted.current = true; join(initialJoin.email, initialJoin.pin) }
  }, [initialJoin, connected, join])
  const participant = session?.participants.find(member => member.id === memberId)
  const applicant = session?.applicants[session.activeIndex]
  const choice = applicant && session?.votes[applicant.id]?.[memberId]
  const full = session && !session.memberIds.includes(memberId) && session.memberIds.length >= session.memberCount
  return <main className={`${embedded ? "" : "min-h-svh px-5 py-8"} flex items-center justify-center bg-white font-sans text-neutral-950`}>
    <div className="w-full max-w-md space-y-7 rounded-2xl border border-neutral-200 bg-white p-6 shadow-none">
      <header className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">OutClass <span className="font-normal text-neutral-500">/ Live vote</span></span><span className="flex items-center gap-1.5 text-xs text-neutral-500"><Radio className="size-3.5" />{connected ? "Connected" : "Connecting"}</span></header>
      {!session || !applicant ? <div role="status" className="space-y-3 py-12 text-center"><Loader2 className="mx-auto size-7 animate-spin text-neutral-400" /><h1 className="text-xl font-semibold tracking-tight">Waiting for the proctor</h1><p className="text-sm leading-6 text-neutral-500">Keep the presentation open in another tab of this browser. If this session has expired, ask the proctor for a new link.</p></div> : session.status === "ended" ? <div role="status" className="space-y-4 py-12 text-center"><CheckCircle2 className="mx-auto size-10" /><h1 className="text-2xl font-semibold tracking-tight">Session complete</h1><p className="text-sm text-neutral-500">Thanks for contributing to deliberations.</p></div> : !participant ? <MobileJoinScreen onJoin={join} pending={joining} error={error} /> : session.status === "lobby" ? <MobileJoinScreen onJoin={join} memberName={participant.name} connected={connected} /> : <>
        <div aria-live="polite" className="space-y-4 text-center">
          <p className="text-xs uppercase tracking-widest text-neutral-500">Applicant {session.activeIndex + 1} of {session.applicants.length}</p>
          <Avatar className="mx-auto size-20 border border-neutral-200"><AvatarImage src={applicant.headshotUrl} alt={`${applicant.name} headshot`} className="object-cover" /><AvatarFallback className="bg-neutral-50 text-2xl">{applicant.initials}</AvatarFallback></Avatar>
          <div><h1 className="text-3xl font-semibold tracking-tight">{applicant.name}</h1><p className="mt-2 text-sm text-neutral-500">{applicant.year} · {applicant.major}</p></div>
        </div>
        {!connected && <p role="status" className="rounded-xl border border-neutral-200 p-4 text-sm text-neutral-600">Connection paused. Keep the proctor’s tab open; voting will resume when it reconnects.</p>}
        {choice ? <div role="status" className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-center"><CheckCircle2 className="mx-auto size-7" /><p className="font-medium">{choice === "pass" ? "Pass" : "No Pass"} vote recorded</p><p className="flex items-center justify-center gap-2 text-sm text-neutral-500"><Loader2 className="size-4 animate-spin" />Waiting for next applicant...</p></div> : full ? <p role="status" className="rounded-xl border border-neutral-200 p-5 text-sm text-neutral-600">All voting member places are filled. Ask the proctor to start a new session with a larger member count.</p> : <div className="space-y-3">
          <p className="text-center text-sm text-neutral-500">Should this applicant advance?</p>
          <button type="button" disabled={!connected || pending} onClick={() => vote("pass")} className="flex min-h-24 w-full items-center justify-center gap-3 rounded-xl border border-emerald-300 bg-white text-2xl font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 disabled:opacity-40"><Check className="size-7" />Pass</button>
          <button type="button" disabled={!connected || pending} onClick={() => vote("no-pass")} className="flex min-h-24 w-full items-center justify-center gap-3 rounded-xl border border-rose-300 bg-white text-2xl font-semibold text-rose-800 transition-colors hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-700 disabled:opacity-40"><X className="size-7" />No Pass</button>
          {pending && <p role="status" className="text-center text-sm text-neutral-500">Confirming your vote…</p>}
          <p className="text-center text-xs text-neutral-500">One vote per applicant. Votes cannot be changed.</p>
        </div>}
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      </>}
      <footer className="border-t border-neutral-200 pt-4 text-xs leading-5 text-neutral-500">Simulated session · syncs tabs in this browser. Personal-device voting requires a server connection.</footer>
    </div>
  </main>
}
