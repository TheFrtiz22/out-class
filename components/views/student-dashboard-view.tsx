"use client"
import type { ReactNode } from "react"
import { SCHEDULING_TIMEZONE } from "@/lib/scheduling-config"
import { AvailabilityDashboardRequests } from "@/components/availability/dashboard-requests"

import { useWelcomeClock } from "@/hooks/use-welcome-clock"
import { Bell, CheckCircle2, ChevronRight, Circle } from "@/components/icons"
import { WelcomeHeader } from "@/components/product/welcome-header"
import { Dashboard, DashboardCard, DashboardFoot, DashboardHero, DashboardMore, DashboardQuiet, DateChipList, GlassRow, GlassRowList, NeedsAction, NeedsYouRow, PipelineBars, type DateChipItem, type NeedsItem } from "@/components/product/dashboard/dashboard"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ClubLogo } from "@/components/club-logo"
import { DirectoryLogo } from "@/components/clubs/directory-logo"
import { useSuggestedClubs } from "@/hooks/use-suggested-clubs"
import { StatusPill } from "@/components/ui/status-pill"
import { useApplicationState } from "@/lib/application-state"
import { useAuth } from "@/contexts/auth-context"
import { eventStart } from "@/lib/calendar"
import { clubWorkspaceHref } from "@/lib/club-workspace"
import {
  homeApplications,
  nextHomeAction,
  relevantUpdates,
  upcomingAgenda,
  type HomeApplication,
  type HomeApplicationSource,
} from "@/lib/student-home"
import type { ClubEvent } from "@/lib/data"
import type { ViewId } from "@/lib/views"
import "./student-home.css"
import { applicationStages as sharedStages, stageCounts } from "@/lib/application-stages"
import { TERMS, pluralize as plural } from "@/lib/copy/terms"

function when(event: ClubEvent | Date) {
  return (event instanceof Date ? event : eventStart(event)).toLocaleString("en-US", {
    timeZone: SCHEDULING_TIMEZONE, hour12: true,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
function applicationNote(app: HomeApplication) {
  return app.draft
    ? app.deadline
      ? `Deadline · ${when(app.deadline)}`
      : app.responsesSaved !== undefined
        ? `${app.responsesSaved} ${app.responsesSaved === 1 ? "response" : "responses"} saved`
        : "Pick up where you left off"
    : app.status === "Interviewing"
      ? "Book your interview / view appointment"
      : app.status === "Accepted"
        ? "Your decision is ready"
        : app.status === "Rejected"
          ? "View your decision"
          : app.status === "Submitted"
            ? "Application submitted"
            : "Check your application for details"
}
/** My applications as stages: drafts, in review, interviews, decisions. Bars are decorative. */
function applicationStages(apps: HomeApplication[]) {
  // Same stages and counting as the Applications page tabs (lib/application-stages).
  const counts = stageCounts(apps.map(app => app.status))
  const tones: Record<string, string | undefined> = { drafts: "warning", "in-review": "info", interviews: "interview" }
  return sharedStages.map(stage => ({ id: stage.id, label: stage.label, count: counts[stage.id], tone: tones[stage.id], href: `/applications?tab=${stage.id}` }))
}

export function StudentDashboardView({
  onNavigate,
  initialData,
  authenticated = false,
}: {
  onNavigate: (view: ViewId) => void
  initialData?: { applications: HomeApplicationSource[] } | null
  authenticated?: boolean
}) {
  const {
    focusApplication,
    events,
    focusEvent,
    trackedApps,
    notifications,
    personalTaskActivities,
    focusNotification,
    hydrated,
  } = useApplicationState()
  const { user, loading } = useAuth()
  const now = useWelcomeClock()
  const realMode = authenticated || !!user || initialData != null
  // Real records always win, including an empty array. Never fall back to browser demo applications.
  const realApps = user
    ? user.applications.map((app) => ({
        ...app,
        answers: initialData?.applications.find((source) => source.id === app.id)?.answers,
      }))
    : initialData?.applications
  const accountEvents = realMode && !authenticated && initialData == null ? [] : events
  const accountNotifications =
    realMode && !authenticated && initialData == null ? [] : notifications
  const applications = homeApplications(
    realMode ? (realApps ?? []) : null,
    trackedApps,
    accountEvents,
  )
  const unavailable = realMode && !realApps && !loading
  const agendaUnavailable = realMode && initialData == null
  const agenda = now ? upcomingAgenda(accountEvents, now) : []
  const updates = relevantUpdates(accountNotifications)
  const next = now ? nextHomeAction(applications, agenda, now, accountNotifications) : { kind: "explore" as const }
  function openApplication(app: HomeApplication) {
    focusApplication(app.clubId)
    onNavigate(app.draft ? "tracker" : "status")
  }
  function openEvent(event: ClubEvent) {
    focusEvent(event.id)
    onNavigate("calendar")
  }

  // Called before the loading return so hook order never changes between renders.
  const { suggestions, hasSignal } = useSuggestedClubs(null, 4)
  const suggestedRows = <GlassRowList>{suggestions.map(({ club, reason }) => <li key={club.id}><GlassRow href={`/club/${encodeURIComponent(club.id)}`} className="oc-home-suggested" title={club.name} detail={reason}
    lead={<DirectoryLogo club={club} />} /></li>)}</GlassRowList>
  const welcome = <WelcomeHeader
    className="oc-home-header"
    now={now} firstName={user?.profile?.firstName}
    eyebrow={now?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) ?? "Your OutClass"}
    context={{ mode: "personal", applications: loading || !hydrated ? null : realApps ?? null, events: accountEvents, notifications: personalTaskActivities?.userId === user?.id ? personalTaskActivities?.items : [], memberClubIds: user?.memberships.filter(m => m.status === "ACTIVE").map(m => m.clubId) ?? [] }}
  />
  const hero = <DashboardHero className="oc-home-hero">{welcome}</DashboardHero>

  if (loading || !hydrated || !now)
    return (
      <div className="oc-student-home">
        {hero}
        <div role="status" aria-busy="true" aria-label="Loading your recruiting season" className="oc-home-loading">
          <Skeleton className="h-36 w-full rounded-[var(--oc-content-radius)]" />
          <Skeleton className="h-64 w-full rounded-[var(--oc-content-radius)]" />
          <span className="sr-only">Loading your recruiting season…</span>
        </div>
      </div>
    )

  // Needs you: only from records this page already reads. The next step (nextHomeAction) leads.
  const memberClubIds = user?.memberships.filter(m => m.status === "ACTIVE").map(m => m.clubId) ?? []
  const taskItems = personalTaskActivities?.userId === user?.id ? personalTaskActivities?.items ?? [] : []
  const overdueTasks = [...new Map(taskItems.flatMap(item => item.clubId && memberClubIds.includes(item.clubId) && item.taskActivity?.needsSubmission && item.taskActivity.dueAt && +new Date(item.taskActivity.dueAt) < now.getTime() ? [[item.taskActivity.assignmentId, item.clubId] as const] : [])).values()]
  // Drafts for a club that stopped taking applications are not work to finish (lib/recruitment-presentation).
  const upcomingDeadlines = applications.filter(app => app.draft && !app.intakeClosed && app.deadline && eventStart(app.deadline) >= now).sort((a, b) => eventStart(a.deadline!).getTime() - eventStart(b.deadline!).getTime())
  const drafts = applications.filter(app => app.draft && !app.intakeClosed && !upcomingDeadlines.includes(app))
  const interviewing = applications.filter(app => app.status === "Interviewing")
  const urgentUpdate = updates.find(update => update.urgent && !update.read)
  const readUpdate = (id: string) => { focusNotification(id); onNavigate("inbox") }
  const needs: (NeedsItem & { order: number })[] = []
  if (upcomingDeadlines[0]) { const app = upcomingDeadlines[0]; needs.push({ order: next.kind === "application" && next.application.id === app.id ? 0 : 1, id: "deadline", title: upcomingDeadlines.length === 1 ? `${app.name} application due` : `${plural(upcomingDeadlines.length, "application")} due`, detail: `Application deadline: ${when(app.deadline!)}`, action: <NeedsAction onClick={() => openApplication(app)}>Continue draft</NeedsAction> }) }
  if (overdueTasks.length) needs.push({ order: 2, id: "tasks", title: `${plural(overdueTasks.length, "club task")} overdue`, detail: "Submit your work or ask your club for more time.", action: <NeedsAction href={`${clubWorkspaceHref(overdueTasks[0]!, "tasks")}&taskView=mine`}>Open tasks</NeedsAction> })
  if (interviewing.length) needs.push({ order: 3, id: "interviews", title: interviewing.length === 1 ? `Interview with ${interviewing[0]!.name}` : `${plural(interviewing.length, "interview invitation")}`, detail: "Book your interview or view your appointment.", action: <NeedsAction onClick={() => openApplication(interviewing[0]!)}>View interview</NeedsAction> })
  if (urgentUpdate) needs.push({ order: next.kind === "notification" ? 0 : 4, id: "update", title: urgentUpdate.title, detail: urgentUpdate.preview, action: <NeedsAction onClick={() => readUpdate(urgentUpdate.id)}>Read update</NeedsAction> })
  if (drafts.length) needs.push({ order: next.kind === "application" && drafts.includes(next.application) ? 0 : 5, id: "drafts", title: drafts.length === 1 ? `Finish your ${drafts[0]!.name} application` : `${plural(drafts.length, "draft")} in progress`, detail: drafts[0]!.responsesSaved !== undefined ? `${plural(drafts[0]!.responsesSaved, "response")} saved` : "Pick up where you left off.", action: <NeedsAction onClick={() => openApplication(drafts[0]!)}>Continue draft</NeedsAction> })
  if (next.kind === "event" && eventStart(next.event).getTime() <= now.getTime() + 48 * 3600000) needs.push({ order: 0, id: "event", title: next.event.title, detail: `${when(next.event)}${next.event.location ? ` · ${next.event.location}` : ""}`, action: <NeedsAction onClick={() => openEvent(next.event)}>View event details</NeedsAction> })
  const needsItems = needs.sort((a, b) => a.order - b.order).slice(0, 4)

  const coming: DateChipItem[] = [
    ...agenda.slice(0, 4).map(event => ({ id: event.id, at: eventStart(event), kind: event.type === "Interview" ? "interview" : undefined, title: event.title,
      detail: [event.type === "Interview" ? "Interview" : event.type === "Coffee Chat" ? "Coffee chat" : "Club event", event.location].filter(Boolean).join(" · "), onClick: () => openEvent(event) })),
    ...upcomingDeadlines.slice(0, 2).map(app => ({ id: `deadline-${app.id}`, at: eventStart(app.deadline!), kind: "deadline", title: `${app.name} application due`, detail: "Deadline", onClick: () => openApplication(app) })),
  ].sort((a, b) => +a.at - +b.at).slice(0, 5)
  const empty = (title: string, copy: string, action: ReactNode) => <div className="oc-dashboard-state"><DashboardQuiet><strong>{title}.</strong> {copy}</DashboardQuiet>{action}</div>
  const stages = applicationStages(applications)

  // Phones: the OutClass app's Home — To-do, Coming up, the furthest-along application, every
  // application, then My clubs — from the same records the desktop dashboard below reads.
  const stageOf = (status: string) => ["Accepted", "Rejected", "Waitlisted"].includes(status) ? 3 : status === "Interviewing" ? 2 : status === "In Review" ? 1 : 0
  const furthest = applications.filter(app => !app.draft && !app.closed && stageOf(app.status) < 3).sort((a, b) => stageOf(b.status) - stageOf(a.status))[0]
  const clubs = user?.memberships.filter(m => m.status === "ACTIVE" && m.club) ?? []
  const phone = <div className="oc-home-phone">
    {unavailable
      ? <Card variant="glass" className="oc-needs-clear" role="status"><div className="oc-dashboard-state"><p><strong>We couldn’t load your applications.</strong> Try again to see the latest information for your account.</p><Button onClick={() => window.location.reload()}>Try again</Button></div></Card>
      : <DashboardCard id="home-phone-todo-title" title="To-do" className="oc-home-phone-todo">
        {needsItems.length ? <ul className="oc-home-todo">{needsItems.map(item => <li key={item.id} data-urgent={item.order === 0 || undefined}>
          <span className="oc-home-todo-box" aria-hidden="true" />
          <span className="oc-home-todo-copy"><strong>{item.title}</strong>{item.detail && <small>{item.detail}</small>}{item.action}</span>
        </li>)}</ul>
          : <DashboardQuiet><strong>You’re clear for now.</strong> Deadlines, interview invitations and club tasks that need you will show up here.</DashboardQuiet>}
      </DashboardCard>}
    {coming.length > 0 && <DashboardCard id="home-phone-agenda-title" title="Coming up" className="oc-home-phone-agenda" more={{ onClick: () => onNavigate("calendar"), label: "Calendar" }}>
      <DateChipList items={coming.slice(0, 3)} when={when} timeZone={SCHEDULING_TIMEZONE} empty="" />
    </DashboardCard>}
    {furthest && <section className="oc-home-furthest" aria-labelledby="home-phone-furthest-title">
      <h2 id="home-phone-furthest-title" className="oc-home-phone-heading">Furthest along</h2>
      {/* A list can't live inside a button: the club name is the button and its hit area covers the card. */}
      <div className="oc-home-furthest-card" role="group" aria-labelledby="home-furthest-open">
        <small>Application status</small>
        <button type="button" id="home-furthest-open" className="oc-home-furthest-open" onClick={() => openApplication(furthest)}>{furthest.name}</button>
        <ol>{["Application submitted", "Club review", "Interview", "Decision"].map((label, i) => {
          const at = stageOf(furthest.status)
          return <li key={label} data-state={i < at ? "done" : i === at ? "current" : undefined}>
            {i < at ? <CheckCircle2 size={20} weight="regular" aria-hidden="true" /> : i === at ? <span className="oc-home-furthest-dot" aria-hidden="true" /> : <Circle size={20} aria-hidden="true" />}
            <span>{i === at && i === 1 ? "Club review in progress" : i === at && i === 2 ? "Interview stage" : label}</span>
          </li>
        })}</ol>
      </div>
    </section>}
    <DashboardCard id="home-phone-applications-title" title="Applications" className="oc-home-phone-applications" more={{ onClick: () => onNavigate("tracker"), label: "View all" }}>
      {applications.length ? <GlassRowList>{applications.slice(0, 5).map(app => <li key={app.id}><GlassRow onClick={() => openApplication(app)} className="oc-home-application" title={app.name} detail={applicationNote(app)}
        lead={<ClubLogo clubId={app.clubId} logoUrl={app.logoUrl} marketing={app.marketing} text={app.name.slice(0, 2)} color={app.color} />}
        trailing={<span className="oc-dashboard-row-end"><StatusPill status={app.status} /></span>} /></li>)}</GlassRowList>
        : <DashboardQuiet><strong>Nothing submitted yet.</strong> Find clubs to apply to in Explore. <DashboardMore onClick={() => onNavigate("explore")}>Explore clubs</DashboardMore></DashboardQuiet>}
    </DashboardCard>
    {suggestions.length > 0 && <DashboardCard id="home-phone-suggested-title" title="Suggested clubs" className="oc-home-phone-suggested" more={{ onClick: () => onNavigate("explore"), label: "Explore" }}>
      {suggestedRows}
    </DashboardCard>}
    <section className="oc-home-phone-clubs" aria-labelledby="home-phone-clubs-title">
      <div className="oc-home-phone-heading-row"><h2 id="home-phone-clubs-title" className="oc-home-phone-heading">{TERMS.myClubs}</h2><DashboardMore onClick={() => onNavigate("my-clubs")}>All clubs</DashboardMore></div>
      {clubs.length ? <ul className="oc-home-club-grid">{clubs.map(m => <li key={m.clubId}><a href={clubWorkspaceHref(m.clubId)} className="oc-home-club-tile">
        <ClubLogo clubId={m.clubId} logoUrl={m.club.logoUrl} text={m.club.name.slice(0, 2)} color={m.club.color ?? undefined} />
        <strong>{m.club.name}</strong><small>{m.role === "PRESIDENT" ? "President" : m.role === "RECRUITMENT_LEAD" ? "Recruitment lead" : "Member"}</small>
      </a></li>)}</ul>
        : <Card variant="glass" className="oc-home-phone-empty"><DashboardQuiet>Clubs you join appear here, with their meetings and tasks.</DashboardQuiet></Card>}
    </section>
  </div>

  return (
    <div className="oc-student-home">
      {hero}
      {/* Mounted once for both layouts, inside the same dashboard context (no blur, card type) as before. */}
      <Dashboard className="oc-home-availability-slot"><AvailabilityDashboardRequests /></Dashboard>
      {phone}
      <Dashboard className="oc-home-dashboard">
        {unavailable
          ? <Card variant="glass" className="oc-needs-clear oc-home-next" role="status"><div className="oc-dashboard-state"><p><strong>We couldn’t load your applications.</strong> Try again to see the latest information for your account.</p><Button onClick={() => window.location.reload()}>Try again</Button></div></Card>
          : <NeedsYouRow headingId="home-next-title" className="oc-home-next" items={needsItems}
            clear={<><strong>You’re clear for now.</strong> {applications.length ? "Your applications are together below. Explore other clubs that interest you." : "Explore clubs, learn what they do, and start an application when you’re ready."} <DashboardMore onClick={() => onNavigate("explore")}>Explore clubs</DashboardMore></>} />}
        <div className="oc-dashboard-grid">
          <div className="oc-dashboard-main">
            <DashboardCard id="home-applications-title" title="Your applications" index={needsItems.length + 1} className="oc-home-applications" more={{ onClick: () => onNavigate("tracker"), label: "View all" }}>
              {applications.length ? <>
                <PipelineBars stages={stages} compactStages={stages} />
                <GlassRowList>{applications.slice(0, 4).map(app => <li key={app.id}><GlassRow onClick={() => openApplication(app)} className="oc-home-application" title={app.name} detail={applicationNote(app)}
                  lead={<ClubLogo clubId={app.clubId} logoUrl={app.logoUrl} marketing={app.marketing} text={app.name.slice(0, 2)} color={app.color} />}
                  trailing={<span className="oc-dashboard-row-end"><StatusPill status={app.status} /><ChevronRight size={16} aria-hidden="true" /></span>} /></li>)}</GlassRowList>
                {applications.length > 4 && <DashboardFoot>Showing 4 of {applications.length} applications</DashboardFoot>}
              </> : empty("No applications yet", "You haven’t started an application. Find a club to apply to and your progress will show here.", <DashboardMore onClick={() => onNavigate("explore")}>Explore clubs</DashboardMore>)}
            </DashboardCard>
            <DashboardCard id="home-updates-title" title={TERMS.inbox} index={needsItems.length + 3} className="oc-home-updates" more={{ onClick: () => onNavigate("inbox"), label: TERMS.openInbox }}>
              {updates.length ? <GlassRowList>{updates.map(update => <li key={update.id}><GlassRow className="oc-home-update" onClick={() => readUpdate(update.id)} title={update.title} note={update.preview}
                lead={<span className="oc-home-update-indicator" data-unread={!update.read} aria-label={update.read ? "Read" : "Unread"}><Bell size={16} aria-hidden="true" /></span>}
                detail={`${update.club}${update.createdAt && Number.isFinite(Date.parse(update.createdAt)) ? ` · ${new Date(update.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}`} /></li>)}</GlassRowList>
                : empty("You’re all caught up", "There are no new application updates or announcements from clubs you belong to.", <DashboardMore onClick={() => onNavigate("explore")}>Find clubs to follow</DashboardMore>)}
            </DashboardCard>
          </div>
          <div className="oc-dashboard-side">
            <DashboardCard id="home-agenda-title" title="Coming up" index={needsItems.length + 2} className="oc-home-agenda" more={{ onClick: () => onNavigate("calendar"), label: "Calendar" }}>
              <DateChipList items={coming} when={when} timeZone={SCHEDULING_TIMEZONE}
                empty={agendaUnavailable
                  ? empty("Your agenda is unavailable", "We couldn’t load your scheduled events just now.", <Button variant="outline" onClick={() => window.location.reload()}>Try again</Button>)
                  : empty("Nothing scheduled yet", "You have no interviews or RSVP’d events coming up.", <DashboardMore onClick={() => onNavigate("corkboard")}>{TERMS.browseEvents}</DashboardMore>)} />
            </DashboardCard>
            <DashboardCard id="home-suggested-title" title="Suggested clubs" index={needsItems.length + 4} className="oc-home-suggested-card" more={{ onClick: () => onNavigate("explore"), label: "Explore" }}>
              {suggestions.length ? suggestedRows
                : <DashboardQuiet>{hasSignal ? "No close matches yet. Browse every club in Explore." : "Save clubs you like in Explore and similar ones will show up here."}</DashboardQuiet>}
            </DashboardCard>
          </div>
        </div>
      </Dashboard>
    </div>
  )
}
