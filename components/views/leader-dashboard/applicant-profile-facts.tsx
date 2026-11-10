import type { ReactNode } from "react"
import type { ProfileFieldVisibility } from "@/lib/profile-field-visibility"
import { safeProfileUrl } from "@/lib/student-profile"

type Experience = { id: string; title: string; subtitle: string; period: string }
export type ApplicantProfileFactsProfile = {
  academicYear?: string | null; gpa?: number | null; satScore?: number | null; actScore?: number | null
  experiences?: Experience[]; linkedinUrl?: string | null
}

/** The academic summary line: only enabled fields that have a value, so nothing renders as an empty label. */
export function applicantProfileFacts(profile: ApplicantProfileFactsProfile, fields: ProfileFieldVisibility) {
  return [
    fields.academicYear && profile.academicYear ? profile.academicYear : null,
    fields.gpa && profile.gpa != null ? `GPA ${profile.gpa}` : null,
    fields.act && profile.actScore != null ? `ACT ${profile.actScore}` : null,
    fields.sat && profile.satScore != null ? `SAT ${profile.satScore}` : null,
  ].filter((fact): fact is string => fact !== null)
}

/** Leader-facing profile body. Hidden fields leave no label, row or placeholder. */
export function ApplicantProfileFacts({ profile, fields, resume, children }: { profile: ApplicantProfileFactsProfile; fields: ProfileFieldVisibility; resume?: ReactNode; children?: ReactNode }) {
  const facts = applicantProfileFacts(profile, fields)
  const experiences = fields.experiences ? profile.experiences ?? [] : []
  const linkedin = fields.linkedin ? safeProfileUrl(profile.linkedinUrl) : undefined
  const showResume = fields.resume && !!resume
  return <>
    {facts.length > 0 && <p className="text-xs text-muted-foreground" data-profile-facts="">{facts.join(" · ")}</p>}
    {children}
    {experiences.map(item => (
      <div key={item.id} className="text-sm" data-profile-field="experiences">
        <p className="font-medium">{item.title}</p>
        <p className="text-muted-foreground">{[item.subtitle, item.period].filter(Boolean).join(" · ")}</p>
      </div>
    ))}
    {(showResume || linkedin) && <div className="flex flex-wrap items-center gap-4 text-sm">
      {showResume && resume}
      {linkedin && <a href={linkedin} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4" data-profile-field="linkedin">LinkedIn<span className="sr-only"> (opens in a new tab)</span></a>}
    </div>}
  </>
}
