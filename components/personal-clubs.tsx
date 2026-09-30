"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight } from "lucide-react"
import { useAuth, type ExtendedMembership } from "@/contexts/auth-context"
import { hasWorkspace } from "@/lib/permissions"
import { getClubWorkspaceOverview } from "@/lib/workspace-api"
import { clubWorkspaceHref } from "@/lib/club-workspace"
import type { PersonalSection } from "@/lib/product-navigation"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { MeetingList } from "@/components/meeting-workspace"
import { ClubTasks } from "@/components/club-tasks"
import { ClubLogo } from "@/components/club-logo"
import { Button } from "@/components/ui/button"
import { memberDate, type MemberOverviewData } from "@/components/member-overview"

export function PersonalClubs({ section }: { section: PersonalSection }) {
  const { user, loading } = useAuth()
  const [selected, setSelected] = useState("")
  const memberships = user?.memberships || []
  const member = memberships.find(m => m.clubId === selected) || memberships[0]
  if (loading) return <p role="status">Loading your clubs…</p>
  if (!member) return <div className="max-w-xl space-y-3 border-t py-8"><h2 className="font-display text-2xl">Your communities start here.</h2><p className="text-sm leading-7 text-muted-foreground">Your clubs will appear once you have a membership. An application decision does not automatically create one.</p><Link href="/?workspace=student&view=discover" className="inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4">Explore clubs <ArrowRight size={15} /></Link></div>
  if (section !== "meetings" && section !== "tasks") return <div className="max-w-4xl space-y-7"><p className="max-w-xl text-sm leading-7 text-muted-foreground">The communities you’re part of, and the next thing to do.</p><ul className="space-y-4">{memberships.map(m => <MembershipRow key={m.id} member={m} />)}</ul></div>
  return <div className="max-w-5xl space-y-8"><label className="block max-w-sm text-sm">Your club<select aria-label="Select your club" className="mt-2 block min-h-11 w-full rounded-md border bg-card px-3" value={member.clubId} onChange={e => { if (canLeaveWorkspace()) setSelected(e.target.value) }}>{memberships.map(m => <option key={m.id} value={m.clubId}>{m.club.name}</option>)}</select></label>
    {section === "meetings" ? <MeetingList key={member.clubId} clubId={member.clubId} embedded personalOnly initialAudience="MEMBERS" /> : <ClubTasks key={member.clubId} clubId={member.clubId} embedded personalOnly />}
  </div>
}
function MembershipRow({ member }: { member: ExtendedMembership }) {
  const [data, setData] = useState<MemberOverviewData | null>(null)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const clubId = member.clubId
  useEffect(() => {
    let current = true
    setData(null); setFailed(false)
    getClubWorkspaceOverview(clubId).then(value => { if (current) setData(value) }).catch(() => { if (current) setFailed(true) })
    return () => { current = false }
  }, [clubId, retry])
  const task = data?.work[0]?.task
  const meeting = data?.meeting
  // Prefer the earlier dated item, then undated personal work. No inferred activity.
  const taskFirst = task && (!meeting || (task.dueAt && +new Date(task.dueAt) <= +new Date(meeting.date)))
  return <li className="rounded-xl border bg-card p-5 sm:p-6"><article>
    <div className="flex items-start gap-4"><ClubLogo clubId={clubId} logoUrl={member.club.logoUrl} text={member.club.name.slice(0, 2)} color={member.club.color || "#142d4e"} size="lg" /><div className="min-w-0 flex-1"><h2 className="break-words font-display text-2xl">{member.club.name}</h2><p className="mt-2 text-xs text-muted-foreground">{member.title || "Member"}{hasWorkspace(member) ? " · Workspace manager" : ""}</p></div></div>
    <div className="mt-5 border-t pt-4 text-sm leading-7">
      {failed ? <div role="status" className="flex flex-wrap items-center gap-2"><p className="text-muted-foreground">Couldn’t load the next item.</p><Button variant="ghost" size="sm" onClick={() => setRetry(n => n + 1)}>Retry</Button></div> : !data ? <p role="status" className="text-muted-foreground">Loading club activity…</p> : taskFirst && task ? <><p className="text-xs text-muted-foreground">Your next task{task.dueAt ? ` · ${+new Date(task.dueAt) < Date.now() ? "Overdue" : "Due"} ${memberDate(task.dueAt)}` : " · No due date"}</p><p className="mt-1 break-words font-medium">{task.title}</p></> : meeting ? <><p className="text-xs text-muted-foreground">Next meeting · {memberDate(meeting.date)}</p><p className="mt-1 break-words font-medium">{meeting.title}</p></> : <p className="text-muted-foreground">No upcoming meeting or outstanding personal work.</p>}
    </div>
    <Link href={clubWorkspaceHref(clubId)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">{hasWorkspace(member) ? "Open managed workspace" : "Open member workspace"}<ArrowRight size={15} aria-hidden="true" /><span className="sr-only"> · {member.club.name}</span></Link>
  </article></li>
}
