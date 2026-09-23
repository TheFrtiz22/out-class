"use client"

import { useState, type FormEvent } from "react"
import { Radio } from "lucide-react"
import { type VotingApplicant, type VotingSession, validateVotingSetup } from "@/lib/live-voting"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { ProctorPresentationView } from "./proctor-presentation-view"
import { currentStudent, rosterMembers } from "@/lib/data"
import { useDemoMode } from "@/contexts/demo-context"

export function LiveVotingLauncher({ applicants }: { applicants: VotingApplicant[] }) {
  const [open, setOpen] = useState(false)
  const [min, setMin] = useState("")
  const [max, setMax] = useState("")
  const [members, setMembers] = useState("5")
  const [error, setError] = useState("")
  const [session, setSession] = useState<VotingSession | null>(null)
  const { isDemoEnabled } = useDemoMode()
  function start(event: FormEvent) {
    event.preventDefault()
    const problem = validateVotingSetup(applicants.length, Number(min), Number(max), Number(members))
    if (problem) { setError(problem); return }
    const pin = String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000)
    const eligibleMembers = [...rosterMembers.map(member => ({ id: member.id, email: member.email, name: member.name, initials: member.initials })), { id: currentStudent.email, email: currentStudent.email, name: currentStudent.name, initials: currentStudent.initials }]
    
    if (isDemoEnabled) {
      // Pre-fill active voting session state with mock participants, progress, and votes
      const mockParticipantIds = Array.from({ length: 18 }, (_, i) => `mock-mem-${i}`)
      const mockParticipants = mockParticipantIds.map((id, i) => ({
        id,
        email: `${id}@example.com`,
        name: `Mock Member ${i}`,
        initials: `M${i}`,
        connections: { "mock-conn": Date.now() }
      }))
      const mockVotes: Record<string, Record<string, "pass" | "no-pass">> = {}
      if (applicants[0]) {
        // Pre-fill votes for the first applicant to show progress
        mockVotes[applicants[0].id] = {}
        for (let i = 0; i < 12; i++) mockVotes[applicants[0].id][`mock-mem-${i}`] = i % 3 === 0 ? "no-pass" : "pass"
      }
      
      setSession({ 
        id: crypto.randomUUID(), 
        pin, 
        clubId: "vvf", 
        eligibleMembers, 
        participants: mockParticipants, 
        applicants: structuredClone(applicants), 
        quota: { min: Number(min), max: Number(max) }, 
        memberCount: 20, 
        activeIndex: 0, 
        slideRevision: 0, 
        revision: 1, 
        status: "live", 
        votes: mockVotes, 
        memberIds: mockParticipantIds 
      })
    } else {
      setSession({ id: crypto.randomUUID(), pin, clubId: "vvf", eligibleMembers, participants: [], applicants: structuredClone(applicants), quota: { min: Number(min), max: Number(max) }, memberCount: Number(members), activeIndex: 0, slideRevision: 0, revision: 0, status: "lobby", votes: {}, memberIds: [] })
    }
    setOpen(false)
  }
  return <>
    <Button variant="outline" size="sm" className="h-8 text-xs shadow-none" disabled={!applicants.length} onClick={() => { setMin(String(Math.min(15, applicants.length))); setMax(String(Math.min(20, applicants.length))); setError(""); setOpen(true) }}><Radio className="size-3.5" />Voting preview</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="border-neutral-200 bg-white font-sans text-neutral-950 shadow-none"><DialogHeader><DialogTitle className="text-2xl tracking-tight">Set the target. Start the discussion.</DialogTitle><DialogDescription>Present {applicants.length} applicants from your current filtered pool, in the displayed order. Set your target quota and the number of voting members.</DialogDescription></DialogHeader>
      <form onSubmit={start} className="space-y-5">
        <fieldset className="grid grid-cols-2 gap-4"><legend className="mb-3 text-sm font-medium">Target quota</legend><div className="space-y-2"><Label htmlFor="voting-min">Minimum passes</Label><Input id="voting-min" type="number" min={1} max={applicants.length} step={1} required value={min} onChange={event => setMin(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="voting-max">Maximum passes</Label><Input id="voting-max" type="number" min={1} max={applicants.length} step={1} required value={max} onChange={event => setMax(event.target.value)} /></div></fieldset>
        <div className="space-y-2"><Label htmlFor="voting-members">Voting members</Label><Input id="voting-members" type="number" min={1} max={500} step={1} required value={members} onChange={event => setMembers(event.target.value)} aria-describedby="voting-rule" /><p id="voting-rule" className="text-xs leading-5 text-neutral-500">A strict majority of this number determines Pass or No Pass. Ties and incomplete votes stay in the remaining pool. The first members to join occupy the available places.</p></div>
        <p className="rounded-xl border border-neutral-200 p-3 text-xs leading-5 text-neutral-500">Demo transport: use member tabs in this browser or the embedded pad. Voting from separate devices needs a real WebSocket service. CRM stages are not changed.</p>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" className="bg-black text-white hover:bg-neutral-800">Open waiting room</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
    <Dialog open={!!session} onOpenChange={() => {}}><DialogContent showCloseButton={false} aria-describedby={undefined} className="inset-0 h-svh w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-0 shadow-none sm:max-w-none" onEscapeKeyDown={event => event.preventDefault()}><DialogTitle className="sr-only">Local voting preview</DialogTitle>{session && <ProctorPresentationView initialSession={session} onClose={() => setSession(null)} />}</DialogContent></Dialog>
  </>
}
