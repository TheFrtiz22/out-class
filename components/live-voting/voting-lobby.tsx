"use client"
import { LoadingState } from "@/components/ui/loading-state"

import { useEffect, useState } from "react"
import { OutClassQRCode } from "@/components/qr/outclass-qr-code"
import { ArrowRight, Users } from "@/components/icons"
import { connectedParticipants, type VotingSession } from "@/lib/live-voting"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/ui/panel"

export function VotingLobby({ session, onBegin }: { session: VotingSession; onBegin: () => void }) {
  const [origin, setOrigin] = useState("")
  useEffect(() => { setOrigin(window.location.origin) }, [])
  const connected = connectedParticipants(session)
  const onlineIds = new Set(connected.map(member => member.id))
  const joinUrl = `${origin}/vote/?session=${encodeURIComponent(session.id)}`
  return <div className="mx-auto grid w-full max-w-[var(--oc-content-width)] gap-8 px-5 py-8 font-sans text-foreground lg:grid-cols-[minmax(0,1fr)_360px] lg:py-12">
    <Panel as="section" className="space-y-6 border-border text-center shadow-none sm:p-8">
      <div><p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Live voting · waiting room</p><h2 className="oc-section-heading mt-3">Join the room.</h2><p className="mt-3 text-sm text-muted-foreground">Scan the code or enter the Session PIN to join.</p></div>
      <div className="mx-auto flex justify-center">
        {origin ? (
          <OutClassQRCode
            value={joinUrl}
            size={280}
            variant="compact"
            showLogo={true}
            ariaLabel="Scan to join this voting session"
            title="Voting Session Join"
          />
        ) : (
          <LoadingState label="Preparing session QR…" layout="inline" rows={3} />
        )}
      </div>
      <div className="space-y-3"><p className="text-sm text-muted-foreground">Or open <a href="/vote/" target="_blank" rel="noopener noreferrer" className="font-medium text-black underline underline-offset-4">{origin ? `${new URL(origin).host}/vote` : "/vote"}</a> and enter</p><p className="text-xs uppercase tracking-widest text-muted-foreground">Session PIN</p><p aria-label={`Session PIN ${session.pin}`} data-testid="session-pin" className="text-5xl font-semibold tracking-[0.18em] tabular-nums sm:text-6xl">{session.pin}</p></div>
      <p className="text-xs leading-5 text-muted-foreground">Demo sync works between tabs in this browser. Scanning from a separate phone requires a connected server. A PIN locates the room; it is not proof of identity.</p>
    </Panel>
    <Panel as="section" className="flex flex-col border-border shadow-none">
      <div className="border-b border-border pb-5"><Users className="mb-4 size-6" /><h2 aria-live="polite" className="oc-section-heading flex items-center gap-2"><span aria-hidden="true" className={`size-2 rounded-full ${connected.length ? "bg-emerald-600" : "bg-secondary"}`} />{connected.length} {connected.length === 1 ? "Member" : "Members"} Connected</h2><p className="mt-2 text-sm text-muted-foreground">{session.participants.length} of {session.memberCount} member places joined</p></div>
      <ul aria-label="Joined members" className="my-5 max-h-[380px] flex-1 space-y-4 overflow-y-auto">
        {session.participants.map(member => <li key={member.id} className="flex items-center gap-3"><Avatar className="size-10 border border-border"><AvatarImage src={member.avatarUrl} alt="" /><AvatarFallback className="bg-muted text-xs">{member.initials}</AvatarFallback></Avatar><div><p className="text-sm font-medium">{member.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{onlineIds.has(member.id) ? "Connected · ready" : "Disconnected · waiting to reconnect"}</p></div></li>)}
        {!session.participants.length && <li className="py-8 text-center text-sm leading-6 text-muted-foreground">Members will appear here as they join.<br />Keep this screen open.</li>}
      </ul>
      <div className="space-y-3 border-t border-border pt-5"><Button className="h-12 w-full bg-black text-white shadow-none hover:bg-primary/90" disabled={!connected.length || session.status !== "lobby"} onClick={onBegin}>Begin Voting<ArrowRight className="size-4" /></Button><p className="text-xs leading-5 text-muted-foreground">{connected.length ? `Ready when you are. Voting still requires a majority of ${session.memberCount} configured members.` : "At least one connected member is required to begin."}</p></div>
    </Panel>
  </div>
}
