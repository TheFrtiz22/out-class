"use client"

import { useEffect, useState } from "react"
import { MemberVotingPad } from "@/components/live-voting/member-voting-pad"
import { MobileJoinScreen } from "@/components/live-voting/mobile-join-screen"
import { findVotingSession } from "@/lib/use-live-voting"
import { LoadingState } from "@/components/ui/loading-state"
import { PageHeader } from "@/components/ui/page-header"
import { Panel } from "@/components/ui/panel"

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
  if (sessionId === null) return <LoadingState label="Opening live voting…" layout="voting" rows={3} />
  if (sessionId && !/^[a-zA-Z0-9-]{1,80}$/.test(sessionId)) return <div className="space-y-4"><PageHeader title="Invalid session link" /><a href="/vote/" className="text-sm underline">Join with your Session PIN</a></div>
  if (!sessionId) return <Panel className="space-y-7"><p className="text-sm font-semibold">Voting preview</p><MobileJoinScreen onJoin={joinByPin} pending={pending} error={error} /><p className="text-xs leading-5 text-muted-foreground">Simulated session · keep the proctor’s tab open in this browser. Separate-device connections need a server.</p></Panel>
  return <MemberVotingPad key={sessionId} sessionId={sessionId} initialJoin={initialJoin} />
}
