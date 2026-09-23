"use client"

import { useEffect, useState } from "react"
import { MemberVotingPad } from "@/components/live-voting/member-voting-pad"
import { MobileJoinScreen } from "@/components/live-voting/mobile-join-screen"
import { findVotingSession } from "@/lib/use-live-voting"

export default function LiveVotingPage() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [initialJoin, setInitialJoin] = useState<{ email: string; pin: string }>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => { setSessionId(new URLSearchParams(window.location.search).get("session") ?? "") }, [])
  async function joinByPin(email: string, pin: string) {
    setPending(true); setError("")
    try {
      const id = await findVotingSession(pin)
      setInitialJoin({ email, pin }); setSessionId(id)
      window.history.replaceState(null, "", `/vote/?session=${encodeURIComponent(id)}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not find that session. Please retry.") }
    finally { setPending(false) }
  }
  if (sessionId === null) return <main className="p-8 font-sans" role="status">Opening voting pad…</main>
  if (sessionId && !/^[a-zA-Z0-9-]{1,80}$/.test(sessionId)) return <main className="mx-auto max-w-md space-y-4 p-8 font-sans"><h1 className="text-2xl font-semibold tracking-tight">Invalid session link</h1><a href="/vote/" className="text-sm underline">Join with your Session PIN</a></main>
  if (!sessionId) return <main className="flex min-h-svh items-center justify-center bg-white px-5 py-8 font-sans"><div className="w-full max-w-md space-y-7 rounded-2xl border border-neutral-200 bg-white p-6 shadow-none"><p className="text-sm font-semibold">OutClass / Voting preview</p><MobileJoinScreen onJoin={joinByPin} pending={pending} error={error} /><p className="text-xs leading-5 text-neutral-500">Simulated session · keep the proctor’s tab open in this browser. Separate-device connections need a server.</p></div></main>
  return <MemberVotingPad key={sessionId} sessionId={sessionId} initialJoin={initialJoin} />
}
