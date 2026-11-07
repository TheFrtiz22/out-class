"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight } from "@/components/icons"
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
import { LoadingState } from "@/components/ui/loading-state"
import { memberDate, type MemberOverviewData } from "@/components/member-overview"
import { DEFAULT_CLUB_COLOR } from "@/lib/club-colors"
import { membershipRoleLabel } from "@/lib/copy/terms"
import { OrganizationOwnershipRequests } from "@/components/organization-ownership-requests"
import { NativeSelect } from "@/components/ui/native-select"

export function PersonalClubs({ section }: { section: PersonalSection }) {
  const { user, loading } = useAuth()
  const [selected, setSelected] = useState("")
  const memberships = user?.memberships || []
  const member = memberships.find(m => m.clubId === selected) || memberships[0]
  if (loading) return <LoadingState label="Loading your clubs…" layout="cards" rows={3} />
  if (!member) return <div className="max-w-xl space-y-3 border-t py-8"><h2 className="oc-section-heading ">You haven’t joined any clubs yet.</h2><p className="text-sm leading-7 text-muted-foreground">Your clubs will appear once you have a membership. An application decision does not automatically create one.</p><Link href="/explore" className="inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4">Explore clubs <ArrowRight size={15} /></Link></div>
  if (section !== "meetings" && section !== "tasks") return <div className="oc-personal-clubs space-y-7"><div className="flex flex-wrap gap-4 text-sm"><Link href="/clubs/tasks" className="inline-flex min-h-11 items-center underline underline-offset-4">Your tasks across clubs</Link></div><OrganizationOwnershipRequests enabled includeDismissed /><ul className="oc-membership-grid">{memberships.map(m => <MembershipRow key={m.id} member={m} />)}</ul><FindOrClaimClub /></div>
  // Meetings and Tasks cover every club by default; the club filter is optional.
  const shown = selected ? memberships.filter(m => m.clubId === selected) : memberships
  return <div className="space-y-4"><label className="block max-w-sm text-sm">Club<NativeSelect aria-label="Filter by club" className="mt-2 block min-h-11 w-full" value={selected} onChange={e => { if (canLeaveWorkspace()) setSelected(e.target.value) }}><option value="">All clubs</option>{memberships.map(m => <option key={m.id} value={m.clubId}>{m.club.name}</option>)}</NativeSelect></label>
    {shown.map(m => <section key={m.clubId} aria-label={m.club.name} className="space-y-2">{shown.length > 1 && <h2 className="oc-section-heading">{m.club.name}</h2>}{section === "meetings" ? <MeetingList clubId={m.clubId} embedded personalOnly initialAudience="MEMBERS" /> : <ClubTasks clubId={m.clubId} embedded personalOnly />}</section>)}
  </div>
}
/** Moved from Settings → Organizations (now redirected to My Clubs). */
function FindOrClaimClub() {
  return <section className="space-y-3 border-t pt-5" aria-label="Request club access"><h2 className="oc-section-heading">Find or claim a club</h2><p className="text-sm leading-6 text-muted-foreground">Find your club in Explore. Unclaimed profiles include a request form for club leaders; managed clubs can invite you to join.</p><Link href="/explore" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Explore clubs</Link></section>
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
  return <li className="oc-membership-card"><article>
    <div className="flex items-start gap-4"><ClubLogo clubId={clubId} logoUrl={member.club.logoUrl} marketing={member.club.marketing} text={member.club.name.slice(0, 2)} color={member.club.color || DEFAULT_CLUB_COLOR} size="lg" /><div className="min-w-0 flex-1"><h2 className="oc-section-heading break-words">{member.club.name}</h2><p className="mt-2 text-xs text-muted-foreground">{membershipRoleLabel(member)}{member.title && member.title !== "Member" && member.title !== membershipRoleLabel(member) ? ` · ${member.title}` : ""}</p></div></div>
    <div className="mt-5 border-t pt-4 text-sm leading-7">
      {failed ? <div role="status" className="flex flex-wrap items-center gap-2"><p className="text-muted-foreground">Couldn’t load the next item.</p><Button variant="ghost" size="sm" onClick={() => setRetry(n => n + 1)}>Retry</Button></div> : !data ? <LoadingState label="Loading club activity…" layout="inline" /> : taskFirst && task ? <><p className="text-xs text-muted-foreground">Your next task{task.dueAt ? ` · ${+new Date(task.dueAt) < Date.now() ? "Overdue" : "Due"} ${memberDate(task.dueAt)}` : " · No due date"}</p><p className="mt-1 break-words font-medium">{task.title}</p></> : meeting ? <><p className="text-xs text-muted-foreground">Next meeting · {memberDate(meeting.date)}</p><p className="mt-1 break-words font-medium">{meeting.title}</p></> : <p className="text-muted-foreground">No upcoming meeting or outstanding personal work.</p>}
    </div>
    <Link href={clubWorkspaceHref(clubId)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">{hasWorkspace(member) ? "Open club workspace" : "Open member workspace"}<ArrowRight size={15} aria-hidden="true" /><span className="sr-only"> · {member.club.name}</span></Link>
  </article></li>
}
