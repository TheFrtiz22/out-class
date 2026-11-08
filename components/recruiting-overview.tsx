"use client"
import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { handleClubLink } from "@/lib/workspace-navigation"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { getDashboardReviewQueue, type getClubWorkspaceOverview } from "@/lib/workspace-api"
import { hasPermission } from "@/lib/permissions"
import { memberDate } from "@/components/member-overview"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/loading-state"
import { Dashboard, DashboardActions, DashboardCard, DashboardFoot, DashboardGrid, DashboardHero, DashboardMore, DashboardQuiet, DateChipList, GlassRow, GlassRowList, MetricTiles, NeedsAction, NeedsYouRow, PipelineBars } from "@/components/product/dashboard/dashboard"
import { keyDates, pipeline, railHrefs, recruitingActive, recruitingNeeds, voteHref, type NeedsCard } from "@/components/club-home/club-home-model"
import { InterviewsCard } from "@/components/club-home/club-home-sections"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"
import { CalendarPlus, Users2 } from "@/components/icons"
import { welcomeDeadline } from "@/lib/welcome"
import { useWelcomeClock } from "@/hooks/use-welcome-clock"
import type { ClubAccess } from "@/lib/permissions"
import "@/components/club-home/club-home.css"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { TERMS } from "@/lib/copy/terms"
import { votingStateLabel } from "@/lib/voting-navigation"
import { DashboardDrawer } from "@/components/product/dashboard-drawer"
const Review = dynamic(() => import("@/components/views/leader-dashboard/live-leader-workspace").then(m => m.ApplicantReviewPreview), { loading: () => <LoadingState variant="glass" layout="form" rows={3} label="Loading authorized review…" /> })
const Preparation = dynamic(() => import("@/components/interviews/dashboard-preparation").then(m => m.DashboardPreparation), { loading: () => <LoadingState variant="glass" label="Checking interview panel…" layout="rows" rows={2} /> })
type Overview = Awaited<ReturnType<typeof getClubWorkspaceOverview>>
/** Intake is closed when applications are switched off or the deadline has passed as of the overview read. */
export function applicationsClosed(op: Overview["operations"]) {
  const deadline = op.intake?.applicationDeadline
  return !op.intake?.applicationOpen || !!deadline && +new Date(deadline) <= +new Date(op.asOf)
}
/**
 * Recruiting Overview hero: "<Cycle> recruiting", the applications badge, the deadline countdown and the
 * two cycle actions, on an interview-purple and navy glow so it reads differently from Club home.
 * Renders before the overview loads (title and actions come from the membership), then fills in.
 */
export function RecruitingHero({ clubId, clubName, membership, data }: { clubId: string; clubName: string; membership: ClubAccess & { id: string }; data: Overview | null }) {
  const now = useWelcomeClock()
  const hrefs = railHrefs(membership, clubId)
  const op = data?.operations
  const cycle = op?.cycles[0]?.name
  const active = !!op && recruitingActive(op)
  const countdown = data && active ? welcomeDeadline({ mode: "club", clubId, membership, data }, now) : null
  return <DashboardHero className="oc-recruiting-hero" glow="recruiting">
    <PageHeader density="expressive" eyebrow={clubName} title={cycle ? `${cycle} recruiting` : TERMS.recruiting}
      description={countdown ?? (active && op?.intake?.applicationDeadline ? `Deadline ${memberDate(op.intake.applicationDeadline)}` : undefined)}
      action={<DashboardActions className="oc-recruiting-actions">
        {active && op?.intake && <Badge variant={applicationsClosed(op) ? "outline" : "success"} className="oc-command-status" data-state={applicationsClosed(op) ? "closed" : "open"}>Applications {applicationsClosed(op) ? "closed" : "open"}</Badge>}
        {/* Cycle actions appear once the overview shows an active cycle; with none, the page offers setup instead. */}
        {active && hrefs.applicants && <Button variant="outline" size="lg" asChild><Link href={hrefs.applicants} onClick={event => { if (!canLeaveWorkspace()) { event.preventDefault(); return } handleClubLink(event, hrefs.applicants!) }}><Users2 aria-hidden="true" />Open applicants</Link></Button>}
        {active && hasPermission(membership, "interviews.manage") && hrefs.interviews && <Button size="lg" data-tone="interview" asChild><Link href={`${hrefs.interviews}&interviewTab=schedule`} onClick={event => { if (!canLeaveWorkspace()) { event.preventDefault(); return } handleClubLink(event, `${hrefs.interviews}&interviewTab=schedule`) }}><CalendarPlus aria-hidden="true" />{TERMS.scheduleInterviews}</Link></Button>}
      </DashboardActions>} />
  </DashboardHero>
}

/** Recruiting Overview: running the cycle. Club work (meetings, tasks, announcements) lives on Club home. */
export function RecruitingOverview({ data, refreshing = false, onChanged = () => {} }: { data: Overview; refreshing?: boolean; onChanged?: () => void }) {
  const { club, membership, operations: op } = data
  const [round, setRound] = useState(""), [applicant, setApplicant] = useState<string | null>(null), [booking, setBooking] = useState<Overview["operations"]["bookings"][number] | null>(null)
  const [reviewContext, setReviewContext] = useState(false)
  const [filteredQueue, setFilteredQueue] = useState<{ key: string; rows: Overview["operations"]["queue"]; error?: string } | null>(null), [retry, setRetry] = useState(0)
  const queueKey = `${round}:${+new Date(op.asOf)}:${retry}`
  useEffect(() => {
    if (!round) return
    let current = true
    getDashboardReviewQueue(club.id, round).then(rows => { if (current) setFilteredQueue({ key: queueKey, rows }) }).catch(() => { if (current) setFilteredQueue({ key: queueKey, rows: [], error: "This round’s review queue could not load." }) })
    return () => { current = false }
  }, [club.id, round, queueKey])
  const hrefs = railHrefs(membership as ClubAccess, club.id)
  const queue = round ? filteredQueue?.key === queueKey ? filteredQueue.rows : [] : op.queue, pending = op.rounds.reduce((n, r) => n + r.pending, 0)
  const base = `/club/${encodeURIComponent(club.id)}/workspace?section=recruitment`
  const outcomes = data.recruitment?.filter(r => ["ACCEPTED", "REJECTED", "WAITLISTED"].includes(r.status)) ?? []
  const hasOutcomes = outcomes.some(r => r.count > 0)
  const canSchedule = hasPermission(membership, "interviews.manage")
  const openReview = (id: string) => { setReviewContext(true); setApplicant(id) }
  const roundName = round ? op.rounds.find(r => r.id === round)?.name : "All rounds"
  const roundPending = round ? op.rounds.find(r => r.id === round)?.pending ?? 0 : pending
  const empty = (copy: ReactNode, action?: ReactNode) => <div className="oc-dashboard-state"><DashboardQuiet>{copy}</DashboardQuiet>{action}</div>
  const statuses = pipeline(data.recruitment)
  const total = op.rounds.reduce((n, r) => n + r.count, 0), reviewed = op.rounds.reduce((n, r) => n + r.reviewed, 0)
  const vote = op.votes.find(v => v.state === "OPEN") ?? op.votes.find(v => v.state === "DRAFT" || v.state === "PAUSED") ?? op.votes[0]
  const dates = keyDates(op)
  const cards = recruitingNeeds(data, hrefs)
  const action = (card: NeedsCard) => card.action.kind === "link" ? <NeedsAction href={card.action.href}>{card.action.label}</NeedsAction>
    : card.action.kind === "applicant" ? <NeedsAction onClick={() => { const a = card.action; if (a.kind === "applicant") { setReviewContext(false); setApplicant(a.applicationId) } }}>{card.action.label}</NeedsAction> : null

  if (!recruitingActive(op)) return <Dashboard className="oc-command-center oc-command-recruiting" busy={refreshing}>
    <div className="oc-dashboard-state oc-recruiting-empty"><DashboardQuiet><strong>No recruiting cycle is active.</strong> Applicants, reviews, interviews and votes show up here once a cycle opens.</DashboardQuiet>
      {hasPermission(membership, "recruitment.manage") && <Button asChild><Link href={`/club/${encodeURIComponent(club.id)}/workspace?section=settings&setting=cycles`}>Set up recruiting</Link></Button>}</div>
  </Dashboard>

  return <Dashboard className="oc-command-center oc-command-recruiting" busy={refreshing}>
    {!hasPermission(membership, "applicants.identify") && hasPermission(membership, "applications.review") && <p className="oc-command-footnote oc-dashboard-note">Anonymous rounds only. Identity, files and unapproved free text remain withheld.</p>}
    <NeedsYouRow headingId="recruiting-needs" items={cards.map(card => ({ id: card.id, title: card.title, detail: card.detail, progress: card.progress, action: action(card) }))}
      clear={<><strong>You’re caught up.</strong> Votes, reviews, interview times and offers that need you will show up here.</>} />
    <DashboardGrid main={<>
      <DashboardCard id="dashboard-pipeline" title="Pipeline by round" index={cards.length + 1} className="oc-pipeline-section">
        {op.rounds.length > 0 ? <>
          <SegmentedControl label="Filter review queue by round" className="oc-command-pipeline" size="compact" value={round}
            onChange={value => setRound(value === round ? "" : value)}
            options={[{ value: "", label: "All rounds" }, ...op.rounds.map(r => ({ value: r.id, label: r.name }))]} />
          <PipelineBars stages={op.rounds.map((r, i) => ({ id: r.id, label: `${String(i + 1).padStart(2, "0")} · ${r.name}`, count: r.count, tone: r.id === round ? "interview" : undefined }))} />
          <DashboardFoot>{[`${total} active ${total === 1 ? "applicant" : "applicants"}`, ...(statuses ? statuses.stages.slice(1).map(stage => `${stage.count} ${stage.label.toLowerCase()}`) : []), `${pending} ${pending === 1 ? "review" : "reviews"} left for you`].join(" · ")}</DashboardFoot>
        </> : empty(hasPermission(membership, "recruitment.manage") ? "No recruiting rounds yet." : "No rounds are available with your current review access.",
          hasPermission(membership, "recruitment.manage") ? <DashboardMore href={`/club/${encodeURIComponent(club.id)}/workspace?section=settings&setting=cycles`}>Set up rounds</DashboardMore> : undefined)}
      </DashboardCard>
      <DashboardCard id="dashboard-reviews" headingTabIndex={-1} index={cards.length + 2} className="oc-review-console" aside={roundName}
        title={<>Review queue <span className="oc-section-count oc-dashboard-count" aria-hidden="true">{roundPending}</span></>}
        more={{ href: `${base}&tool=applicants`, label: "All applicants", prefetch: false, onClick: event => handleClubLink(event as React.MouseEvent<HTMLAnchorElement>, `${base}&tool=applicants`) }}>
        <p className="oc-command-footnote oc-dashboard-note">Applicants waiting on your review</p>
        {round && filteredQueue?.key !== queueKey ? <LoadingState variant="glass" label="Loading this round’s reviews…" layout="rows" rows={3} />
          : round && filteredQueue?.error ? <div role="alert" className="oc-dashboard-state"><p>{filteredQueue.error}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>Retry reviews</Button></div>
          : queue.length ? <GlassRowList className="oc-review-records">{queue.map((a, index) => <li key={a.id}><GlassRow data-applicant-id={a.id} onClick={() => openReview(a.id)}
            lead={<span className="oc-record-number oc-dashboard-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>} title={a.label} detail={`${a.round} · ${a.anonymous ? "Anonymous review" : "Current panel assignment"}`} trailing={<span className="oc-dashboard-row-end">Review</span>} /></li>)}</GlassRowList>
          : empty(round ? "You have no reviews waiting in this round." : "You have no reviews waiting. You’re caught up on your assigned applicants.",
            round ? <DashboardMore onClick={() => setRound("")}>Show all rounds</DashboardMore> : undefined)}
        {!round && pending > op.queue.length && <DashboardFoot>Showing the oldest {op.queue.length} of {pending} reviews. Saving a review brings the next candidate into this preview.</DashboardFoot>}
      </DashboardCard>
      {(op.bookings.length > 0 || canSchedule && op.rounds.some(r => r.needsBooking > 0))
        ? <InterviewsCard data={data} hrefs={hrefs} index={cards.length + 3} onOpen={setBooking} />
        : <DashboardCard id="club-home-interviews" title="Interviews" index={cards.length + 3} more={canSchedule && hrefs.interviews ? { href: `${hrefs.interviews}&interviewTab=schedule`, label: TERMS.scheduleInterviews } : undefined} moreAt="foot">
            <DashboardQuiet>{canSchedule ? "No interviews in the next 7 days." : "Your assigned rooms show up here when interviews are scheduled."}</DashboardQuiet>
          </DashboardCard>}
    </>} side={<>
      <DashboardCard id="dashboard-milestones" title="Key dates" index={cards.length + 2} className="oc-milestone-agenda">
        <DateChipList when={memberDate} items={dates.map(d => ({ id: d.id, at: d.at, kind: d.kind, title: d.title }))} empty="No deadlines or scheduled messages this week." />
      </DashboardCard>
      {hasOutcomes && <DashboardCard id="dashboard-outcomes" title="Outcomes" index={cards.length + 3} className="oc-decision-summary">
        <MetricTiles items={outcomes.map(r => ({ key: r.status, label: r.status === "ACCEPTED" ? "Accepted" : r.status === "WAITLISTED" ? "Waitlisted" : "Not accepted", value: r.count }))} />
        <DashboardFoot>Recorded outcomes are visible to applicants; voting stays separate until published.</DashboardFoot>
      </DashboardCard>}
      {total > 0 && <DashboardCard id="dashboard-coverage" title="Reviewer progress" index={cards.length + 4} className="oc-coverage-panel">
        <MetricTiles items={[{ label: "Applicants with a submitted review", value: reviewed, of: total }]} />
        <progress className="oc-dashboard-progress" value={reviewed} max={total} aria-label="Team review progress" />
      </DashboardCard>}
      {vote && <DashboardCard id="dashboard-voting" title="Voting" index={cards.length + 5} className="oc-voting-summary">
        <GlassRowList><li><GlassRow title={vote.round.name} detail={vote.state === "COMPLETE" || vote.state === "COMPLETED" ? "Voting complete · Send decisions when you are ready" : `${votingStateLabel(vote.state)} session`}
          action={<Button variant="outline" asChild><Link href={voteHref(club.id, membership, vote)}>{!vote.participants.length && vote.joinOpenedAt && !hasPermission(membership, "decisions.manage") ? "Join session" : TERMS.openSession}</Link></Button>} /></li></GlassRowList>
      </DashboardCard>}
    </>} />
    {applicant && <Review key={applicant} clubId={club.id} applicationId={applicant} onClose={() => setApplicant(null)} onChanged={onChanged} onNext={reviewContext && queue.some(a => a.id !== applicant) ? () => setApplicant(queue.find(a => a.id !== applicant)!.id) : undefined} />}
    {booking && <DashboardDrawer title="Prepare for interview" description="Current official panel validation and your authorized interview entry." onClose={() => setBooking(null)}><Preparation clubId={club.id} booking={booking} member={membership} /></DashboardDrawer>}
  </Dashboard>
}
