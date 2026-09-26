"use client"
import Link from "next/link"
import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { hasWorkspace } from "@/lib/permissions"
import type { PersonalSection } from "@/lib/product-navigation"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { MeetingList } from "@/components/meeting-workspace"
import { ClubTasks } from "@/components/club-tasks"
export function PersonalClubs({ section }: { section: PersonalSection }) {
  const { user, loading } = useAuth()
  const [selected, setSelected] = useState("")
  const memberships = user?.memberships || []
  const member = memberships.find(m => m.clubId === selected) || memberships[0]
  if (loading) return <p role="status">Loading your clubs…</p>
  if (!member) return <div className="space-y-3 border-t py-8"><h2 className="font-display text-2xl">Your communities start here.</h2><p className="text-sm text-muted-foreground">Your clubs will appear once you have a membership. An application decision does not automatically create one.</p></div>
  return <div className="space-y-8"><label className="block max-w-sm text-sm">Your club<select aria-label="Select your club" className="mt-2 block min-h-11 w-full rounded-md border bg-card px-3" value={member.clubId} onChange={e => { if (canLeaveWorkspace()) setSelected(e.target.value) }}>{memberships.map(m => <option key={m.id} value={m.clubId}>{m.club.name}</option>)}</select></label>
    {section === "meetings" ? <MeetingList key={member.clubId} clubId={member.clubId} embedded personalOnly initialAudience="MEMBERS" /> : section === "tasks" ? <ClubTasks key={member.clubId} clubId={member.clubId} embedded personalOnly /> : <div className="divide-y border-y">{memberships.map(m => <div key={m.id} className="flex flex-wrap items-center justify-between gap-4 py-6"><div><h2 className="font-display text-2xl">{m.club.name}</h2><p className="mt-2 text-sm text-muted-foreground">{m.title || (hasWorkspace(m) ? "Member · workspace manager" : "Member")}</p></div><Link className="min-h-11 py-3 text-sm underline underline-offset-4" href={`/club/${m.clubId}/workspace`}>{hasWorkspace(m) ? "Enter managed workspace" : "Open club workspace"} →</Link></div>)}</div>}
  </div>
}
