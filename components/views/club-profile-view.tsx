"use client"
import Link from "next/link"
import { UnclaimedProfileNotice } from "@/components/clubs/unclaimed-profile-notice"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CorkboardButton } from "@/components/clubs/corkboard-button"
import { SubscribeButton } from "@/components/clubs/subscribe-button"
import { RecruitmentTimeline } from "@/components/clubs/recruitment-timeline"
import { useClubCustomization } from "@/lib/club-customization"
import { useApplicationState } from "@/lib/application-state"
import { useDemoMode } from "@/contexts/demo-context"
import { useAuth } from "@/contexts/auth-context"
import { clubRecruitment, recruitmentDate } from "@/lib/recruitment-presentation"
import { StatusBadge } from "@/components/status-badge"
import { startClubApplication } from "@/lib/workspace-api"
import { MarketingProfile, MarketingSections } from "@/components/clubs/marketing-profile"
import { profileDraft, readMarketing } from "@/lib/club-marketing"
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
  backLabel = "Back to Discover",
}: {
  club: DirectoryClub
  onBack: () => void
  onNavigate: (view: ViewId) => void
  preview?: boolean
  backLabel?: string
}) {
  const demo = useDemoMode()
  const sampleDeadline = demo.isDemoEnabled ? demo.state?.clubs.find(c => c.id === club.id)?.deadline : null
  const { state, configured, ready } = useClubCustomization(club.id)
  const { trackedApps, applyToClub, events, respondToEvent, focusEvent, focusApplication } =
    useApplicationState()
  const { user, refreshUser } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const heading = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ready && !preview) heading.current?.focus()
  }, [ready, preview])
  const real = club.source === "database"
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer) }, [])
  const recruitment = clubRecruitment({ ...club, applicationDeadline: club.applicationDeadline || sampleDeadline }, now)
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
  const publicProfile = profileDraft({ ...club, name, color: accent, tagline: customized ? profile.tagline : club.pitch, description: about,
    ...(customized ? {
      acceptanceRate: profile.acceptance.trim() ? Number(profile.acceptance.replace(/[^0-9.]/g, "")) : null,
      aumValue: profile.aum.trim() ? Number(profile.aum.replace(/[^0-9.]/g, "")) : null,
      marketing: { ...readMarketing(club.marketing), showAcceptance: profile.showAcceptance, showAum: profile.showAum, placements: profile.showPlacements ? profile.placements.split("\n").filter(Boolean) : [] },
    } : {}),
  })
  const draft = !!application && /draft/i.test(application.status)
  const applyLabel = busy ? "Opening…" : application ? draft ? "Continue draft" : "View status" : !recruitment.available && real ? "Applications unavailable" : real && !user ? "Sign in to apply" : "Start application"
  const applyDisabled = preview || busy || (real && !application && !recruitment.available)
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
      onNavigate(application && !draft ? "status" : "tracker")
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
        {backLabel}
      </Button>
      {!real && (
        <p className="oc-club-preview-note">
          {preview ? "Club profile preview" : "Sample club profile"} ·{" "}
          {configured ? "Includes changes saved on this device" : "Illustrative information"}
        </p>
      )}
      <div className="oc-club-recruitment-summary" role="note"><span data-available={recruitment.available}>{recruitment.label}</span><p>{recruitment.deadline ? `${demo.isDemoEnabled ? "Sample deadline" : "Deadline"} · ${recruitmentDate(recruitment.deadline)}` : "Recruitment deadline not published"}</p>{application && <StatusBadge status={application.status} />}</div>
      <div ref={heading} tabIndex={-1} aria-label={name} className="outline-none">
        <MarketingProfile profile={publicProfile} action={<Button disabled={applyDisabled} onClick={() => void apply()}>{applyLabel}<ArrowRight size={15} aria-hidden="true" /></Button>} />
      </div>
      {real && !demo.isDemoEnabled && <UnclaimedProfileNotice club={club} />}
      <div className="oc-club-profile-grid mt-6">
        <aside className="oc-club-recruitment" aria-labelledby="club-recruitment">
          <p className="oc-club-eyebrow">Your next step</p>
          <h2 id="club-recruitment">Recruitment</h2>
          <p>
            {recruitment.deadline ? `${demo.isDemoEnabled ? "Sample application deadline" : "Application deadline"}: ${recruitmentDate(recruitment.deadline)}` : deadline ? `Application deadline: ${deadline.date} · ${deadline.time}` : "Recruitment dates have not been published."}
            {recruitment.expired && " The deadline has passed. Existing drafts remain available."}
          </p>
          {application && <RecruitmentTimeline status={application.status} rounds={real ? club.rounds : undefined} roundId={actualApplication?.roundId} />}
          <Button
            style={customized ? { backgroundColor: accent, color: contrast } : undefined}
            className="oc-club-apply"
            disabled={applyDisabled}
            onClick={() => void apply()}
          >
            {applyLabel}
            <ArrowRight size={15} />
          </Button>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          {!preview && <CorkboardButton club={club} onNavigate={onNavigate} />}
          <SubscribeButton clubId={club.id} disabled={preview} />
          <div className="oc-club-requirements">
            <h3>Before you apply</h3>
            <p>Your OutClass profile is the starting point for your application.</p>
{real && club.testRequirement && <p className="my-3 text-sm">Standardized tests: {club.testRequirement === "OPTIONAL" ? "SAT and ACT optional" : club.testRequirement.replaceAll("_", " ") + " required"}. Scores are provided through your student profile.</p>}
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
      <nav aria-label="Club profile links" className="my-4 flex flex-wrap gap-x-6 gap-y-2">
        {real && <Link className="oc-profile-link" href={`/meetings?clubId=${club.id}`}>Meetings, agendas, and recaps ↗</Link>}
        {user?.memberships.some(m=>m.clubId===club.id) && <Link className="oc-profile-link" href={`/club/${club.id}/workspace`}>Open club workspace ↗</Link>}
      </nav>
          <MarketingSections profile={publicProfile} />
          <section className="oc-club-events" aria-labelledby="club-events">
            <h2 id="club-events">Events & important dates</h2>
            {real ? (
              publicEvents.length ? (
                <ul>
                  {publicEvents.map((event) => (
                    <li key={event.id}>
                      <CalendarDays size={18} aria-hidden="true" />
                      <div>
                        <h3><a className="underline underline-offset-4" href={`/corkboard?event=${event.id}`}>{event.title}</a></h3>
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
                      <h3><a className="underline underline-offset-4" href={`/corkboard?event=${event.id}`}>{event.title}</a></h3>
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
