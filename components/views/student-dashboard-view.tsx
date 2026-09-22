"use client"

import { useEffect, useState } from "react"
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Compass,
  FileText,
  Bell,
  MapPin,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ClubLogo } from "@/components/club-logo"
import { StatusBadge } from "@/components/status-badge"
import { useApplicationState } from "@/lib/application-state"
import { useAuth } from "@/contexts/auth-context"
import { eventStart } from "@/lib/calendar"
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

function when(event: ClubEvent) {
  return eventStart(event).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
function SectionTitle({
  id,
  title,
  action,
  onClick,
}: {
  id: string
  title: string
  action: string
  onClick: () => void
}) {
  return (
    <div className="oc-home-section-title">
      <h2 id={id}>{title}</h2>
      <Button variant="ghost" size="sm" onClick={onClick}>
        {action}
        <ArrowRight size={14} aria-hidden="true" />
      </Button>
    </div>
  )
}
function ApplicationRow({ app, onOpen }: { app: HomeApplication; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        className="oc-home-application"
        onClick={onOpen}
        aria-label={`${app.draft ? "Continue" : "View"} ${app.name} application`}
      >
        <ClubLogo
          clubId={app.clubId}
          logoUrl={app.logoUrl}
          text={app.name.slice(0, 2)}
          color={app.color}
        />
        <span className="oc-home-app-copy">
          <strong>{app.name}</strong>
          <span>
            {app.draft
              ? app.deadline
                ? `Deadline · ${when(app.deadline)}`
                : app.responsesSaved !== undefined
                  ? `${app.responsesSaved} ${app.responsesSaved === 1 ? "response" : "responses"} saved`
                  : "Pick up where you left off"
              : app.status === "Interviewing"
                ? "Review your interview details"
                : app.status === "Accepted"
                  ? "Your decision is ready"
                  : app.status === "Rejected"
                    ? "View your decision"
                    : app.status === "Submitted"
                      ? "Application submitted"
                      : "Check your application for details"}
          </span>
        </span>
        <StatusBadge status={app.status} />
        <ChevronRight size={16} className="oc-home-row-arrow" aria-hidden="true" />
      </button>
    </li>
  )
}
function AgendaRow({ event, onOpen }: { event: ClubEvent; onOpen: () => void }) {
  const date = eventStart(event)
  return (
    <li>
      <button
        type="button"
        className="oc-home-agenda-row"
        onClick={onOpen}
        aria-label={`${event.title}, ${when(event)}`}
      >
        <span className="oc-home-date" aria-hidden="true">
          <span>{date.toLocaleDateString("en-US", { month: "short" })}</span>
          <strong>{date.getDate()}</strong>
        </span>
        <span className="oc-home-agenda-copy">
          <span className="oc-home-event-type">
            {event.type === "Interview"
              ? "Interview"
              : event.type === "Coffee Chat"
                ? "Coffee chat"
                : "Club event"}{" "}
            · {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
          <strong>{event.title}</strong>
          {event.location && (
            <span>
              <MapPin size={12} aria-hidden="true" />
              {event.location}
            </span>
          )}
        </span>
        <ChevronRight size={15} aria-hidden="true" />
      </button>
    </li>
  )
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
    focusNotification,
    hydrated,
  } = useApplicationState()
  const { user, loading } = useAuth()
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const refresh = () => setNow(new Date())
    refresh()
    const timer = setInterval(refresh, 60000)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [])
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
  const active = applications.filter((app) => !app.closed)
  const interviews = agenda.filter((event) => event.type === "Interview")
  const next = now ? nextHomeAction(applications, agenda, now) : { kind: "discover" as const }
  function openApplication(app: HomeApplication) {
    focusApplication(app.clubId)
    onNavigate("tracker")
  }
  function openEvent(event: ClubEvent) {
    focusEvent(event.id)
    onNavigate("calendar")
  }

  if (loading || !hydrated || !now)
    return (
      <div className="oc-student-home" role="status" aria-label="Loading your recruiting season">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="mt-5 h-4 w-48" />
        <Skeleton className="mt-10 h-36 w-full" />
        <Skeleton className="mt-10 h-64 w-full" />
        <span className="sr-only">Loading your recruiting season…</span>
      </div>
    )

  const nextTitle =
    next.kind === "application"
      ? `Continue your ${next.application.name} application.`
      : next.kind === "event"
        ? next.event.title
        : applications.length
          ? "A little room to explore."
          : "Find your first opportunity."
  const nextCopy =
    next.kind === "application"
      ? next.application.deadline
        ? `Application deadline: ${when(next.application.deadline)}.`
        : "Your draft is ready. Review your responses and pick up where you left off."
      : next.kind === "event"
        ? `${when(next.event)}${next.event.location ? ` · ${next.event.location}` : ""}`
        : applications.length
          ? "Your applications are together below. Discover other clubs that interest you."
          : "Explore clubs, learn what they do, and start an application when you’re ready."
  const nextLabel =
    next.kind === "application"
      ? "Continue application"
      : next.kind === "event"
        ? "View event details"
        : "Discover clubs"

  return (
    <div className="oc-student-home">
      <header className="oc-home-greeting">
        <p className="oc-home-eyebrow">
          Your recruiting season <span aria-hidden="true">/</span>{" "}
          <time dateTime={now.toISOString()}>
            {now.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
          </time>
        </p>
        <h1>Welcome back{user?.profile?.firstName ? `, ${user.profile.firstName}` : ""}.</h1>
        <p>Your applications, next steps, and upcoming conversations.</p>
      </header>
      {unavailable ? (
        <section className="oc-home-next" role="status">
          <div>
            <h2>We couldn’t load your applications.</h2>
            <p>Try again to see the latest information for your account.</p>
          </div>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </section>
      ) : (
        <>
          <div className="oc-home-summary" aria-label="Recruiting summary">
            <button onClick={() => onNavigate("tracker")}>
              <strong>{active.length}</strong> active{" "}
              {active.length === 1 ? "application" : "applications"}
            </button>
            {!agendaUnavailable && (
              <>
                <span aria-hidden="true" />
                <button onClick={() => onNavigate("calendar")}>
                  <strong>{agenda.length}</strong> upcoming{" "}
                  {agenda.length === 1 ? "event" : "events"}
                </button>
              </>
            )}
            {interviews.length > 0 && (
              <>
                <span aria-hidden="true" />
                <button onClick={() => openEvent(interviews[0])}>
                  <strong>{interviews.length}</strong>{" "}
                  {interviews.length === 1 ? "interview" : "interviews"}
                </button>
              </>
            )}
          </div>
          <section className="oc-home-next" aria-labelledby="home-next-title">
            <div>
              <p className="oc-home-eyebrow">
                {next.kind === "discover" ? "Make your next move" : "Up next"}
              </p>
              <h2 id="home-next-title">{nextTitle}</h2>
              <p>{nextCopy}</p>
            </div>
            <Button
              onClick={() =>
                next.kind === "application"
                  ? openApplication(next.application)
                  : next.kind === "event"
                    ? openEvent(next.event)
                    : onNavigate("discover")
              }
            >
              {nextLabel}
              <ArrowRight size={15} aria-hidden="true" />
            </Button>
          </section>
        </>
      )}
      <div className="oc-home-columns">
        <section className="oc-home-applications" aria-labelledby="home-applications-title">
          <SectionTitle
            id="home-applications-title"
            title="Your applications"
            action="View all"
            onClick={() => onNavigate("tracker")}
          />
          {applications.length ? (
            <ul className="oc-home-list">
              {applications.slice(0, 5).map((app) => (
                <ApplicationRow key={app.id} app={app} onOpen={() => openApplication(app)} />
              ))}
            </ul>
          ) : (
            <div className="oc-home-empty">
              <FileText size={23} strokeWidth={1.5} aria-hidden="true" />
              <h3>{unavailable ? "Applications are unavailable" : "No applications yet"}</h3>
              <p>
                {unavailable
                  ? "Reload the page to try again."
                  : "When you start an application, your progress and updates will appear here."}
              </p>
            </div>
          )}
          {applications.length > 5 && (
            <p className="oc-home-list-note">Showing 5 of {applications.length} applications</p>
          )}
        </section>
        <section className="oc-home-agenda" aria-labelledby="home-agenda-title">
          <SectionTitle
            id="home-agenda-title"
            title="Coming up"
            action="Calendar"
            onClick={() => onNavigate("calendar")}
          />
          {agenda.length ? (
            <ul className="oc-home-list">
              {agenda.slice(0, 4).map((event) => (
                <AgendaRow key={event.id} event={event} onOpen={() => openEvent(event)} />
              ))}
            </ul>
          ) : (
            <div className="oc-home-agenda-empty">
              <CalendarDays size={22} strokeWidth={1.5} aria-hidden="true" />
              <h3>{agendaUnavailable ? "Your agenda is unavailable" : "No upcoming events"}</h3>
              <p>
                {agendaUnavailable
                  ? "Reload the page to check your scheduled events."
                  : "Your scheduled interviews and club events will appear here."}
              </p>
              {agendaUnavailable && (
                <Button variant="ghost" className="mt-3" onClick={() => window.location.reload()}>
                  Try again
                </Button>
              )}
            </div>
          )}
        </section>
        {updates.length > 0 && (
          <section className="oc-home-updates" aria-labelledby="home-updates-title">
            <SectionTitle
              id="home-updates-title"
              title="Updates for you"
              action="Open inbox"
              onClick={() => onNavigate("inbox")}
            />
            <ul className="oc-home-list">
              {updates.map((update) => (
                <li key={update.id}>
                  <button
                    className="oc-home-update"
                    onClick={() => {
                      focusNotification(update.id)
                      onNavigate("inbox")
                    }}
                  >
                    <span
                      className="oc-home-update-indicator"
                      data-unread={!update.read}
                      aria-label={update.read ? "Read" : "Unread"}
                    >
                      <Bell size={16} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{update.title}</strong>
                      <span>{update.preview}</span>
                      <small>
                        {update.club}
                        {update.createdAt && Number.isFinite(Date.parse(update.createdAt))
                          ? ` · ${new Date(update.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                          : ""}
                      </small>
                    </span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="oc-home-discovery" aria-labelledby="home-discover-title">
          <Compass size={20} strokeWidth={1.5} aria-hidden="true" />
          <h2 id="home-discover-title">There’s more to discover.</h2>
          <p>Find clubs that share your interests. Take a closer look at what they’re building.</p>
          <Button variant="ghost" onClick={() => onNavigate("discover")}>
            Explore clubs
            <ArrowRight size={14} aria-hidden="true" />
          </Button>
        </section>
      </div>
    </div>
  )
}
