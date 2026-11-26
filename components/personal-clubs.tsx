"use client"
import { PillSelect } from "@/components/ui/pill-select"
import { SearchField } from "@/components/ui/search-field"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
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
import { EmptyState } from "@/components/ui/empty-state"
import { memberDate, type MemberOverviewData } from "@/components/member-overview"
import { DEFAULT_CLUB_COLOR } from "@/lib/club-colors"
import { membershipRoleLabel } from "@/lib/copy/terms"
import { OrganizationOwnershipRequests } from "@/components/organization-ownership-requests"
import { clubMonogram } from "@/lib/club-assets"

export function PersonalClubs({ section }: { section: PersonalSection }) {
  const { user, loading } = useAuth()
  const [selected, setSelected] = useState("")
  const memberships = user?.memberships || []
  const member = memberships.find(m => m.clubId === selected) || memberships[0]
  if (loading) return <LoadingState label="Loading your clubs…" layout="cards" rows={3} />
  if (!member) return <div className="oc-workspace-stack">{/* Invitations can create a first membership, so they show without one (Settings → Organizations redirects here). */}{section === "clubs" && <OrganizationOwnershipRequests enabled includeDismissed />}<EmptyState align="start" tone="outlined" title="You haven’t joined any clubs yet" description="Clubs appear here once you’re a member. An acceptance doesn’t make you a member on its own." action={<Button asChild variant="outline"><Link href="/explore">Explore clubs <ArrowRight size={16} aria-hidden="true" /></Link></Button>} /></div>
  if (section !== "meetings" && section !== "tasks") return <div className="oc-personal-clubs space-y-7"><div className="flex flex-wrap gap-4 text-sm"><Link href="/clubs/tasks" className="inline-flex min-h-11 items-center underline underline-offset-4">Your tasks across clubs</Link></div><OrganizationOwnershipRequests enabled includeDismissed /><ul className="oc-membership-grid">{memberships.map(m => <MembershipRow key={m.id} member={m} />)}</ul><FindOrClaimClub /></div>
  // Meetings and Tasks cover every club by default; the club filter is optional.
  const clubFilter = memberships.length > 1 ? <PillSelect label="Filter by club" allLabel="All clubs" size="compact" active={!!selected} value={selected} onChange={value => { if (canLeaveWorkspace()) setSelected(value) }} options={memberships.map(m => ({ value: m.clubId, label: m.club.name }))} /> : null
  // One meeting list for every club the person belongs to, so its filters appear once; each row names its club.
  if (section === "meetings") return <MeetingList clubId={selected || undefined} clubIds={memberships.map(m => m.clubId)} filters={clubFilter} embedded personalOnly initialAudience="MEMBERS" />
  if (memberships.length === 1) return <ClubTasks clubId={member.clubId} embedded personalOnly />
  return <AllClubTasks memberships={selected ? memberships.filter(m => m.clubId === selected) : memberships} clubFilter={clubFilter} />
}
/** One filter row for every club's tasks; each club's list follows it and is headed only when it has tasks to show. */
function AllClubTasks({ memberships, clubFilter }: { memberships: ExtendedMembership[]; clubFilter: ReactNode }) {
  const [filter, setFilter] = useState("open"), [query, setQuery] = useState(""), [counts, setCounts] = useState<Record<string, number>>({})
  const onCount = useCallback((clubId: string, count: number) => setCounts(current => current[clubId] === count ? current : { ...current, [clubId]: count }), [])
  const reporters = useMemo(() => Object.fromEntries(memberships.map(m => [m.clubId, (count: number) => onCount(m.clubId, count)])), [memberships, onCount])
  const filtered = filter !== "open" || !!query.trim()
  const settled = memberships.every(m => counts[m.clubId] !== undefined), none = settled && memberships.every(m => counts[m.clubId] === 0)
  return <div className="oc-personal-tasks space-y-4">
    <div role="toolbar" aria-label="Task filters" className="oc-task-filters">
      {clubFilter}
      {filter !== "projects" && <PillSelect label="Status" prefix="Status" size="compact" active={filter !== "open"} value={filter} onChange={setFilter} options={[{ value: "open", label: "Active" }, { value: "due", label: "Due" }, { value: "overdue", label: "Overdue" }, { value: "submitted", label: "Submitted" }, { value: "completed", label: "Completed" }, { value: "all", label: "All tasks" }]} />}
      <PillSelect label="Group by" prefix="Group by" size="compact" active={filter === "projects"} value={filter === "projects" ? "project" : "none"} onChange={next => setFilter(next === "project" ? "projects" : "open")} options={[{ value: "none", label: "None" }, { value: "project", label: "Project" }]} />
      <SearchField aria-label="Search tasks" value={query} onChange={event => setQuery(event.target.value)} onClear={() => setQuery("")} placeholder="Search tasks" containerClassName="oc-task-search-control" />
    </div>
    {memberships.map(m => <section key={m.clubId} aria-label={m.club.name} className="space-y-2">{counts[m.clubId] !== 0 && counts[m.clubId] !== undefined && <h2 className="oc-section-heading">{m.club.name}</h2>}<ClubTasks clubId={m.clubId} embedded personalOnly shared={{ filter, query, onCount: reporters[m.clubId] }} /></section>)}
    {none && <EmptyState role="status" tone="outlined" density="compact" title={filtered ? "No tasks match your filters." : "You're all caught up."} description={filtered ? "Try another search or clear the filters." : "No tasks need your attention. Choose All tasks under Status to see earlier work."} action={filtered ? <Button type="button" variant="outline" size="sm" onClick={() => { setQuery(""); setFilter("open") }}>Clear filters</Button> : undefined} />}
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
    <div className="flex items-start gap-4"><ClubLogo clubId={clubId} logoUrl={member.club.logoUrl} marketing={member.club.marketing} text={clubMonogram(member.club.name)} color={member.club.color || DEFAULT_CLUB_COLOR} size="lg" /><div className="min-w-0 flex-1"><h2 className="oc-section-heading break-words">{member.club.name}</h2><p className="mt-2 text-xs text-muted-foreground">{membershipRoleLabel(member)}{member.title && member.title !== "Member" && member.title !== membershipRoleLabel(member) ? ` · ${member.title}` : ""}</p></div></div>
    <div className="mt-5 border-t pt-4 text-sm leading-7">
      {failed ? <div role="status" className="flex flex-wrap items-center gap-2"><p className="text-muted-foreground">Couldn’t load the next item.</p><Button variant="ghost" size="sm" onClick={() => setRetry(n => n + 1)}>Retry</Button></div> : !data ? <LoadingState label="Loading club activity…" layout="inline" /> : taskFirst && task ? <><p className="text-xs text-muted-foreground">Your next task{task.dueAt ? ` · ${+new Date(task.dueAt) < Date.now() ? "Overdue" : "Due"} ${memberDate(task.dueAt)}` : " · No due date"}</p><p className="mt-1 break-words font-medium">{task.title}</p></> : meeting ? <><p className="text-xs text-muted-foreground">Next meeting · {memberDate(meeting.date)}</p><p className="mt-1 break-words font-medium">{meeting.title}</p></> : <p className="text-muted-foreground">No upcoming meeting or outstanding personal work.</p>}
    </div>
    <Link href={clubWorkspaceHref(clubId)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">{hasWorkspace(member) ? "Open club workspace" : "Open member workspace"}<ArrowRight size={16} aria-hidden="true" /><span className="sr-only"> · {member.club.name}</span></Link>
  </article></li>
}
