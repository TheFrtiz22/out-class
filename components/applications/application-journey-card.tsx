"use client"
import { ArrowRight, CalendarDays, Clock3, FileCheck2, FilePenLine } from "lucide-react"
import { ClubLogo } from "@/components/club-logo"
import { StatusBadge } from "@/components/status-badge"
import { RecruitmentTimeline } from "@/components/clubs/recruitment-timeline"

/** Presentation only: fetching, scope, drafts and navigation stay with the workflow. */
export function ApplicationJourneyCard({ id, club, status, round, nextStep, showIcon = true, onOpen }: {
  id: string; club: { id: string; name: string; color?: string | null; logoUrl?: string | null }; status: string; round?: string | null; nextStep: string; showIcon?: boolean; onOpen: () => void
}) {
  const draft = status === "DRAFTING"
  const Icon = draft ? FilePenLine : status === "INTERVIEWING" ? CalendarDays : ["ACCEPTED", "REJECTED", "WAITLISTED"].includes(status) ? FileCheck2 : Clock3
  return <article className="oc-application-row" data-status={status}>
    <div className="oc-application-identity">
      <ClubLogo clubId={club.id} logoUrl={club.logoUrl} color={club.color || "#142d45"} text={club.name.split(/\s+/).map(word => word[0]).slice(0,2).join("")} size="lg" />
      <div className="min-w-0"><h2><button type="button" data-application-id={id} onClick={onOpen}>{club.name}<span className="sr-only"> · {draft ? "Continue draft" : "View application"}</span></button></h2>
        <p className="oc-application-round">{draft ? "Draft · not yet applied" : round ? `Club round: ${round}` : "Club round not provided"}</p>
      </div>
      <StatusBadge status={status} className="oc-application-status" />
    </div>
    <div className="oc-application-progress"><RecruitmentTimeline status={status} compact /></div>
    <div className="oc-application-next" data-has-icon={showIcon}>{showIcon && <Icon className="oc-application-next-icon" size={20} aria-hidden="true" />}<p>{nextStep}</p><span aria-hidden="true">{draft ? "Continue draft" : "View details"}<ArrowRight size={15} /></span></div>
  </article>
}
