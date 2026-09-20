"use client"

import { useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { ArrowRight, Users } from "lucide-react"
import { connectedParticipants, type VotingSession } from "@/lib/live-voting"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

export function VotingLobby({ session, onBegin }: { session: VotingSession; onBegin: () => void }) {
  const [origin, setOrigin] = useState("")
  useEffect(() => { setOrigin(window.location.origin) }, [])
  const connected = connectedParticipants(session)
  const onlineIds = new Set(connected.map(member => member.id))
  const joinUrl = `${origin}/vote/?session=${encodeURIComponent(session.id)}`
  return <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-8 font-sans text-neutral-950 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-12">
    <section className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-none sm:p-8">
      <div><p className="text-xs font-medium uppercase tracking-widest text-neutral-500">Live voting · waiting room</p><h2 className="mt-3 text-4xl font-semibold tracking-tight">Join the room.</h2><p className="mt-3 text-sm text-neutral-500">Scan the code or enter the Session PIN to join.</p></div>
      <div className="mx-auto w-full max-w-[360px] rounded-xl border border-neutral-200 bg-white p-3">
        {origin ? <QRCodeSVG value={joinUrl} size={336} marginSize={4} level="M" title="Scan to join this voting session" className="h-auto w-full" /> : <div role="status" className="aspect-square content-center text-sm text-neutral-500">Preparing session QR…</div>}
      </div>
      <div className="space-y-3"><p className="text-sm text-neutral-500">Or open <a href="/vote/" target="_blank" rel="noopener noreferrer" className="font-medium text-black underline underline-offset-4">{origin ? `${new URL(origin).host}/vote` : "/vote"}</a> and enter</p><p className="text-xs uppercase tracking-widest text-neutral-500">Session PIN</p><p aria-label={`Session PIN ${session.pin}`} data-testid="session-pin" className="text-5xl font-semibold tracking-[0.18em] tabular-nums sm:text-6xl">{session.pin}</p></div>
      <p className="text-xs leading-5 text-neutral-500">Demo sync works between tabs in this browser. Scanning from a separate phone requires a connected server. A PIN locates the room; it is not proof of identity.</p>
    </section>
    <section className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-none">
      <div className="border-b border-neutral-200 pb-5"><Users className="mb-4 size-6" /><h2 aria-live="polite" className="flex items-center gap-2 text-xl font-semibold tracking-tight"><span aria-hidden="true" className={`size-2 rounded-full ${connected.length ? "bg-emerald-600" : "bg-neutral-300"}`} />{connected.length} {connected.length === 1 ? "Member" : "Members"} Connected</h2><p className="mt-2 text-sm text-neutral-500">{session.participants.length} of {session.memberCount} member places joined</p></div>
      <ul aria-label="Joined members" className="my-5 max-h-[380px] flex-1 space-y-4 overflow-y-auto">
        {session.participants.map(member => <li key={member.id} className="flex items-center gap-3"><Avatar className="size-10 border border-neutral-200"><AvatarImage src={member.avatarUrl} alt="" /><AvatarFallback className="bg-neutral-50 text-xs">{member.initials}</AvatarFallback></Avatar><div><p className="text-sm font-medium">{member.name}</p><p className="mt-0.5 text-xs text-neutral-500">{onlineIds.has(member.id) ? "Connected · ready" : "Disconnected · waiting to reconnect"}</p></div></li>)}
        {!session.participants.length && <li className="py-8 text-center text-sm leading-6 text-neutral-500">Members will appear here as they join.<br />Keep this screen open.</li>}
      </ul>
      <div className="space-y-3 border-t border-neutral-200 pt-5"><Button className="h-12 w-full bg-black text-white shadow-none hover:bg-neutral-800" disabled={!connected.length || session.status !== "lobby"} onClick={onBegin}>Begin Voting<ArrowRight className="size-4" /></Button><p className="text-xs leading-5 text-neutral-500">{connected.length ? `Ready when you are. Voting still requires a majority of ${session.memberCount} configured members.` : "At least one connected member is required to begin."}</p></div>
    </section>
  </div>
}
