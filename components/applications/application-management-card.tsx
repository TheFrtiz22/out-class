"use client"
import { ArrowRight, Check, FilePenLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ClubLogo } from "@/components/club-logo"
import type { StudentApplication } from "./application-form"
import { applicantDate } from "./application-status-card"

export function ApplicationManagementCard({ application: app, deadline, onOpen }: { application: StudentApplication; deadline?: Date | string; onOpen: () => void }) {
  const draft = app.status === "DRAFTING"
  const required = app.club.questions.filter(question => question.required)
  const answered = required.filter(question => app.answers.some(answer => answer.questionId === question.id && answer.response.trim())).length
  return <article className="oc-application-management-row">
    <ClubLogo clubId={app.clubId} logoUrl={app.club.logoUrl} text={app.club.name.slice(0, 2)} color={app.club.color || "#142d45"} />
    <div className="min-w-0 flex-1"><h2>{app.club.name}</h2><p>{draft ? required.length ? `${answered} of ${required.length} required responses saved` : "No required club questions" : app.submittedAt ? `Submitted ${applicantDate(app.submittedAt)}` : "Submitted application"}</p>
      {draft && <p>{deadline ? `Sample deadline · ${applicantDate(deadline)}` : "Deadline not provided on OutClass"}</p>}</div>
    <span className="oc-management-state">{draft ? <FilePenLine size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}{draft ? "Draft" : "Submitted"}</span>
    <Button variant={draft ? "default" : "outline"} data-application-id={app.id} onClick={onOpen}>{draft ? "Continue draft" : "View responses"}<ArrowRight size={15} aria-hidden="true" /></Button>
  </article>
}
