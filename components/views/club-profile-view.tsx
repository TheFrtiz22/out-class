"use client"
import { useServerAnchoredNow } from "@/hooks/use-server-now"
import Link from "next/link"
import { eventScheduleLabel, eventDateLabel, eventTimeLabel } from "@/lib/campus-events"
import { UnclaimedProfileNotice } from "@/components/clubs/unclaimed-profile-notice"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Check, ArrowUpRight } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/loading-state"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CorkboardButton } from "@/components/clubs/corkboard-button"
import { ShareClubButton } from "@/components/clubs/share-club-button"
import { RecruitmentTimeline } from "@/components/clubs/recruitment-timeline"
import { useClubCustomization } from "@/lib/club-customization"
import { useApplicationState } from "@/lib/application-state"
import { useDemoMode } from "@/contexts/demo-context"
import { useAuth } from "@/contexts/auth-context"
import { clubRecruitment, recruitmentDate } from "@/lib/recruitment-presentation"
import { StatusPill } from "@/components/ui/status-pill"
import { startClubApplication } from "@/lib/workspace-api"
import { AboutSection, FaqSection, LifeSection, MarketingProfile, MembersSection, RecruitmentNotes } from "@/components/clubs/marketing-profile"
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
  backLabel = "Back to Explore",
  serverNow,
}: {
  club: DirectoryClub
  onBack: () => void
  onNavigate: (view: ViewId) => void
  preview?: boolean
  backLabel?: string
  /** The server's render time, when this view is server-rendered: deadline state follows the server. */
  serverNow?: number
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
    if (ready && !preview) heading.current?.focus({ preventScroll: true })
  }, [ready, preview])
  const real = club.source === "database"
  const now = useServerAnchoredNow(serverNow)
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
    0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] > 0.179 ? "var(--foreground)" : "var(--primary-foreground)"
  const about = customized ? profile.about : club.description || club.pitch
  const actualApplication = user?.applications.find((app) => app.clubId === club.id)
  const localApplication = trackedApps.find((app) => app.clubId === club.id)
  const application = real ? actualApplication : localApplication
  const upcoming = events
    .filter(
      (event) =>
        event.clubId === club.id && event.type !== "Deadline" && eventStart(event) >= new Date(now),
    )
    .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())
  const deadline = !real
    ? events
        .filter(
          (event) =>
            event.clubId === club.id &&
            event.type === "Deadline" &&
            eventStart(event) >= new Date(now),
        )
        .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())[0]
    : undefined
  const publicEvents = (club.publicEvents || []).filter(
    (event) => new Date(event.endDate || event.date) >= new Date(now),
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
  // A rejected student may start a new application in the club's next cycle.
  const reapply = real && actualApplication?.status === "REJECTED" && recruitment.available
  const applyLabel = busy ? "Opening…" : reapply ? "Apply again" : application ? draft ? "Continue draft" : "View status" : real && !user ? "Sign in to apply" : "Start application"
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
      if (!application || reapply) {
        const result = real ? await startClubApplication(club.id) : null
        if (result && result.applicationId === null) {
          setError(result.unavailable)
          return
        }
        applyToClub({
          id: club.id,
          name,
          logoText: club.logoText,
          logoUrl: club.logoUrl,
          marketing: club.marketing,
          color: club.color,
          applicationId: result?.applicationId,
        })
        if (real) await refreshUser()
      }
      if (real && actualApplication && !localApplication && !reapply)
        applyToClub({
          id: club.id,
          name,
          logoText: club.logoText,
          logoUrl: club.logoUrl,
          marketing: club.marketing,
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
      onNavigate(application && !draft && !reapply ? "status" : "tracker")
    } catch {
      setError("We couldn’t open your application. Please try again.")
    } finally {
      setBusy(false)
    }
  }
  // Real clubs render from server data; only sample clubs wait for device customization.
  if (!ready && !real) return <LoadingState label="Loading club profile…" layout="workspace" rows={3} />
  const closed = real && !application && !recruitment.available
  const deadlineText = recruitment.deadline
    ? `${demo.isDemoEnabled ? "Sample application deadline" : "Application deadline"}: ${recruitmentDate(recruitment.deadline)}`
    : deadline ? `Application deadline: ${deadline.date} · ${deadline.time}` : ""
  const primaryAction = <div className="oc-club-action-row">
    {closed
      ? <>
          {!preview && <CorkboardButton club={club} onNavigate={onNavigate} mode="follow" variant="default" className="oc-club-apply" />}
          {real && !preview && <ShareClubButton club={club} className="oc-club-share" />}
          <p className="oc-club-action-note">Applications aren’t open yet · Follow to keep this club in your saved clubs</p>
        </>
      : <>
          <Button style={customized ? { backgroundColor: accent, color: contrast } : undefined} className="oc-club-apply" disabled={applyDisabled} onClick={() => void apply()}>
            {applyLabel}
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
          {real && !preview && <CorkboardButton club={club} onNavigate={onNavigate} mode="follow" className="oc-club-follow" />}
          {real && !preview && <ShareClubButton club={club} className="oc-club-share" />}
          {(recruitment.deadline || deadline) && <p className="oc-club-action-note">{recruitment.closingSoon ? "Closing soon · " : ""}{deadlineText}</p>}
        </>}
    {application && <StatusPill status={application.status} />}
    {error && <p role="alert" className="w-full text-destructive">{error}</p>}
  </div>
  const showRequirements = real && (!!club.testRequirement || !!club.timeCommitment || !!club.requirements?.length)
  const recruitmentSection = !!deadlineText || recruitment.expired || !!application || showRequirements || readMarketing(publicProfile.marketing).sections.some(section => section.visible && section.kind === "recruitment")
  return (
    <article className="oc-club-profile">
      <Button variant="ghost" className="oc-club-back" onClick={onBack} disabled={preview}>
        <ArrowLeft size={16} aria-hidden="true" />
        {backLabel}
      </Button>
      {!real && (
        <p className="oc-club-preview-note">
          {preview ? "Club profile preview" : "Sample club profile"} ·{" "}
          {configured ? "Includes changes saved on this device" : "Illustrative information"}
        </p>
      )}
      <div ref={heading} tabIndex={-1} aria-label={name} className="outline-none">
        <MarketingProfile profile={publicProfile} action={primaryAction} />
      </div>
      {real && !demo.isDemoEnabled && !club.claimed && <UnclaimedProfileNotice club={club} />}
      <AboutSection profile={publicProfile}>
        {(real || user?.memberships.some(m => m.clubId === club.id)) && <nav aria-label="Club pages" className="oc-club-links">
          {real && <Link className="oc-tap-link" href={`/meetings?clubId=${club.id}`}>Meetings, agendas and recaps <ArrowUpRight size={14} aria-hidden="true" /></Link>}
          {user?.memberships.some(m => m.clubId === club.id) && <Link className="oc-tap-link" href={`/club/${club.id}/workspace`}>Open club workspace <ArrowUpRight size={14} aria-hidden="true" /></Link>}
        </nav>}
      </AboutSection>
      <MembersSection profile={publicProfile} />
      {recruitmentSection && <section className="oc-club-section oc-club-recruitment-section" aria-labelledby="club-recruitment">
        <h2 id="club-recruitment">Recruitment and requirements</h2>
        {deadlineText && <p className="oc-club-prose">{deadlineText}{recruitment.expired && " The deadline has passed. Existing drafts remain available."}</p>}
        {application && <RecruitmentTimeline status={application.status} rounds={real ? club.rounds : undefined} roundId={actualApplication?.roundId} />}
        <RecruitmentNotes profile={publicProfile} />
        {showRequirements && <div className="oc-club-subsection">
          <h3>Before you apply</h3>
          <p className="oc-club-prose">Your OutClass profile is the starting point for your application.</p>
          {club.testRequirement && <p className="oc-club-prose">Standardized tests: {club.testRequirement === "OPTIONAL" ? "SAT and ACT optional" : club.testRequirement.replaceAll("_", " ") + " required"}. Scores come from your student profile.</p>}
          {club.timeCommitment && <p className="oc-club-prose">Time commitment: {club.timeCommitment} hours per week.</p>}
          {!!club.requirements?.length && <>
            <h4 className="oc-club-minor-heading">Required club questions</h4>
            <ul className="oc-club-check-list">
              {club.requirements.map((requirement, index) => <li key={index}><Check size={16} aria-hidden="true" />{requirement}</li>)}
            </ul>
          </>}
        </div>}
      </section>}
      <LifeSection profile={publicProfile} />
      <FaqSection profile={publicProfile} />
      {(real ? publicEvents.length > 0 : upcoming.length > 0) && <section className="oc-club-section oc-club-events" aria-labelledby="club-events">
        <h2 id="club-events">Events</h2>
        {real ? (
          <ul>
            {publicEvents.map((event) => (
              <li key={event.id}>
                <CalendarDays size={16} aria-hidden="true" />
                <div>
                  <h3><a className="oc-tap-link" href={`/corkboard?event=${event.id}`}>{event.title}</a></h3>
                  <time dateTime={event.date}>
                    {event.endDate ? eventScheduleLabel({ ...event, endDate: event.endDate }) : `${eventDateLabel(event.date)} · ${eventTimeLabel(event.date)}`}
                  </time>
                  {event.location && <p><MapPin size={14} aria-hidden="true" />{event.location}</p>}
                  {event.description && <p>{event.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul>
            {upcoming.map((event) => (
              <li key={event.id}>
                <CalendarDays size={16} aria-hidden="true" />
                <div>
                  <h3><a className="oc-tap-link" href={`/corkboard?event=${event.id}`}>{event.title}</a></h3>
                  <p>{event.date} · {event.time}</p>
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
        )}
      </section>}
      {roster.length > 0 && (
        <section className="oc-club-section oc-club-leadership" aria-labelledby="club-leaders">
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
    </article>
  )
}
