"use client"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ClubLogo } from "@/components/club-logo"
import { DirectoryLogo } from "@/components/clubs/directory-logo"
import { SubscribeButton } from "@/components/clubs/subscribe-button"
import { RecruitmentTimeline } from "@/components/clubs/recruitment-timeline"
import { useClubCustomization } from "@/lib/club-customization"
import { useApplicationState } from "@/lib/application-state"
import { useDemoMode } from "@/contexts/demo-context"
import { useAuth } from "@/contexts/auth-context"
import { startClubApplication } from "@/lib/workspace-api"
import { clubs } from "@/lib/data"
import { eventStart } from "@/lib/calendar"
import type { DirectoryClub } from "@/lib/club-directory"
import type { ViewId } from "@/lib/views"
import "@/components/clubs/club-discovery.css"

export function ClubProfileView({
  club,
  onBack,
  onNavigate,
  preview = false,
}: {
  club: DirectoryClub
  onBack: () => void
  onNavigate: (view: ViewId) => void
  preview?: boolean
}) {
  const demo = useDemoMode()
  const sampleDeadline = demo.isDemoEnabled ? demo.state?.clubs.find(c => c.id === club.id)?.deadline : null
  const { state, configured, ready } = useClubCustomization(club.id)
  const { trackedApps, applyToClub, events, respondToEvent, focusEvent, focusApplication } =
    useApplicationState()
  const { user, refreshUser } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (ready && !preview) heading.current?.focus()
  }, [ready, preview])
  const real = club.source === "database"
  const customized = !real && (configured || club.id === "vvf")
  const profile = state.profile
  const name = customized ? profile.name : club.name
  const accent = customized ? profile.accent : club.color
  const rgb = /^#[0-9a-f]{6}$/i.test(accent)
    ? accent
        .slice(1)
        .match(/.{2}/g)!
        .map((value) => parseInt(value, 16) / 255)
    : [0, 0, 0]
  const linear = rgb.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  )
  const contrast =
    0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] > 0.179 ? "#000" : "#fff"
  const about = customized ? profile.about : club.description || club.pitch
  const actualApplication = user?.applications.find((app) => app.clubId === club.id)
  const localApplication = trackedApps.find((app) => app.clubId === club.id)
  const application = real ? actualApplication : localApplication
  const upcoming = events
    .filter(
      (event) =>
        event.clubId === club.id && event.type !== "Deadline" && eventStart(event) >= new Date(),
    )
    .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())
  const deadline = !real
    ? events
        .filter(
          (event) =>
            event.clubId === club.id &&
            event.type === "Deadline" &&
            eventStart(event) >= new Date(),
        )
        .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())[0]
    : undefined
  const publicEvents = (club.publicEvents || []).filter(
    (event) => new Date(event.date) >= new Date(),
  )
  const roster =
    !real && (!customized || profile.showDirectory)
      ? clubs.find((item) => item.id === club.id)?.exec || []
      : []
  const stats = [
    ...((!customized || profile.showAcceptance) &&
    (customized ? !!profile.acceptance : club.acceptanceRate != null)
      ? [
          {
            label: "Acceptance rate",
            value: customized ? profile.acceptance : `${club.acceptanceRate}%`,
          },
        ]
      : []),
    ...((!customized || profile.showAum) && (customized ? !!profile.aum : club.aumValue != null)
      ? [
          {
            label: "Assets under management",
            value: customized ? profile.aum : `$${club.aumValue!.toLocaleString()}`,
          },
        ]
      : []),
    ...(customized && profile.showPlacements && profile.placements
      ? [{ label: "Alumni & placements", value: profile.placements }]
      : []),
  ]
  async function apply() {
    if (preview) return
    if (real && !user) {
      onNavigate("auth")
      return
    }
    setError("")
    setBusy(true)
    try {
      if (!application) {
        const result = real ? await startClubApplication(club.id) : null
        applyToClub({
          id: club.id,
          name,
          logoText: club.logoText,
          logoUrl: club.logoUrl,
          color: club.color,
          applicationId: result?.applicationId,
        })
        if (real) await refreshUser()
      }
      if (real && actualApplication && !localApplication)
        applyToClub({
          id: club.id,
          name,
          logoText: club.logoText,
          logoUrl: club.logoUrl,
          color: club.color,
          applicationId: actualApplication.id,
          applicationStatus:
            actualApplication.status === "DRAFTING"
              ? "Drafting"
              : actualApplication.status === "INTERVIEWING"
                ? "1st Round Interview"
                : ["ACCEPTED", "REJECTED", "WAITLISTED"].includes(actualApplication.status)
                  ? "Decision Pending"
                  : "Submitted",
        })
      focusApplication(club.id)
      onNavigate("tracker")
    } catch {
      setError("We couldn’t open your application. Please try again.")
    } finally {
      setBusy(false)
    }
  }
  if (!ready) return <p role="status">Loading club profile…</p>
  return (
    <article className="oc-club-profile">
      <Button variant="ghost" className="oc-club-back" onClick={onBack} disabled={preview}>
        <ArrowLeft size={15} />
        Back to clubs
      </Button>
      {real && !demo.isDemoEnabled && (
        <div className="my-4 flex flex-wrap items-center gap-3 border-y py-4 text-sm">
          <span>{club.claimed ? "Club-managed profile" : "Unclaimed · Basic information provided by OutClass"}</span>
          {club.directorySource && <a className="underline" href={club.directorySource} target="_blank" rel="noreferrer">Directory source</a>}
          {!club.claimed && <a className="font-medium underline" href={`/club-claims/${club.id}`}>Claim this club</a>}
        </div>
      )}
      {real && club.testRequirement && <p className="my-3 text-sm">Standardized tests: {club.testRequirement === "OPTIONAL" ? "SAT and ACT optional" : club.testRequirement.replaceAll("_", " ") + " required"}. Scores are provided through your student profile.</p>}
      {!real && (
        <p className="oc-club-preview-note">
          {preview ? "Club profile preview" : "Sample club profile"} ·{" "}
          {configured ? "Includes changes saved on this device" : "Illustrative information"}
        </p>
      )}
      <header className="oc-club-identity">
        {real ? (
          <DirectoryLogo club={club} size="xl" />
        ) : (
          <ClubLogo
            clubId={club.id}
            logoUrl={club.logoUrl}
            text={
              customized
                ? name
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((word) => word[0])
                    .slice(0, 3)
                    .join("")
                : club.logoText
            }
            color={accent}
            size="xl"
          />
        )}
        <div>
          <p className="oc-club-eyebrow">
            University of Virginia <span> / </span>
            {club.category}
          </p>
          <h1 ref={heading} tabIndex={-1}>
            {name}
          </h1>
          <p>{customized ? profile.tagline : club.pitch}</p>
        </div>
      </header>
      {club.tags.length > 0 && (
        <ul className="oc-club-tags" aria-label="Club interests">
          {club.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
      {club.bannerUrl && (
        <img
          className="oc-club-banner"
          src={club.bannerUrl}
          alt=""
          width={1120}
          height={200}
          loading="lazy"
        />
      )}
      <div className="oc-club-profile-grid">
        <aside className="oc-club-recruitment" aria-labelledby="club-recruitment">
          <p className="oc-club-eyebrow">Your next step</p>
          <h2 id="club-recruitment">Recruitment</h2>
          <p>
            {sampleDeadline ? `Sample application deadline: ${sampleDeadline.toLocaleString()}` : deadline
              ? `Application deadline: ${deadline.date} · ${deadline.time}`
              : "Recruitment dates have not been published."}
          </p>
          {application && <RecruitmentTimeline status={application.status} />}
          <Button
            style={customized ? { backgroundColor: accent, color: contrast } : undefined}
            className="oc-club-apply"
            disabled={preview || busy || (real && !application && !club.applicationAvailable)}
            onClick={() => void apply()}
          >
            {busy
              ? "Opening application…"
              : application
                ? /draft/i.test(application.status)
                  ? "Continue application"
                  : "View application"
                : real && !club.applicationAvailable
                  ? "Application not available"
                  : real && !user
                    ? "Sign in to apply"
                    : "Start application"}
            <ArrowRight size={15} />
          </Button>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <SubscribeButton clubId={club.id} disabled={preview} />
          <div className="oc-club-requirements">
            <h3>Before you apply</h3>
            <p>Your OutClass profile is the starting point for your application.</p>
            {club.timeCommitment && <p>Time commitment: {club.timeCommitment} hours per week.</p>}
            {club.requirements?.length ? (
              <>
                <h4>Required club questions</h4>
                <ul>
                  {club.requirements.map((requirement, index) => (
                    <li key={index}>
                      <Check size={13} aria-hidden="true" />
                      {requirement}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>No additional requirements have been published.</p>
            )}
          </div>
        </aside>
        <div>
          <section aria-labelledby="club-about">
            <h2 id="club-about">About the organization</h2>
            <p className="oc-club-about">{about || "This club hasn’t added a description yet."}</p>
          </section>
          {stats.length > 0 && (
            <section className="oc-club-facts" aria-labelledby="club-facts">
              <h2 id="club-facts">At a glance</h2>
              <p className="oc-club-disclosure">
                {real || configured
                  ? "Club-reported figures · not independently verified"
                  : "Sample figures · not verified club outcomes"}
              </p>
              <dl>
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <dt>{stat.label}</dt>
                    <dd>{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <section className="oc-club-events" aria-labelledby="club-events">
            <h2 id="club-events">Events & important dates</h2>
            {real ? (
              publicEvents.length ? (
                <ul>
                  {publicEvents.map((event) => (
                    <li key={event.id}>
                      <CalendarDays size={18} aria-hidden="true" />
                      <div>
                        <h3>{event.title}</h3>
                        <time dateTime={event.date}>
                          {new Date(event.date).toLocaleString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </time>
                        <p>
                          <MapPin size={12} aria-hidden="true" />
                          {event.location}
                        </p>
                        {event.description && <p>{event.description}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No upcoming public events have been published.</p>
              )
            ) : upcoming.length ? (
              <ul>
                {upcoming.map((event) => (
                  <li key={event.id}>
                    <CalendarDays size={18} aria-hidden="true" />
                    <div>
                      <h3>{event.title}</h3>
                      <p>
                        {event.date} · {event.time}
                      </p>
                      {event.location && <p>{event.location}</p>}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={preview}
                      onClick={() => {
                        if (event.managedEventId && !event.readOnly)
                          respondToEvent(event.id, "going")
                        focusEvent(event.id)
                        onNavigate("calendar")
                      }}
                    >
                      {event.managedEventId && event.response !== "going" ? "RSVP" : "View details"}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No upcoming public events have been published.</p>
            )}
          </section>
          {roster.length > 0 && (
            <section className="oc-club-leadership" aria-labelledby="club-leaders">
              <h2 id="club-leaders">Leadership</h2>
              <ul>
                {roster.map((person) => (
                  <li key={person.name}>
                    <Avatar>
                      <AvatarFallback>{person.initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <strong>{person.name}</strong>
                      <span>{person.role}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </article>
  )
}
