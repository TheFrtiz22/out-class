import { z } from "zod"
import { applicantFields, displayConfigSchema, type ApplicantDisplayConfig } from "@/lib/applicant-display"

// Header contains identity/photo; the slide has two rows of four readable information cells.
// Rendered preview sizing protects readability; selected values are never clipped or truncated.
export const liveVotingFields = applicantFields
export const defaultVotingDisplay: ApplicantDisplayConfig = { version: 1, fields: ["photo", "name", "major", "academicYear", "gpa", "resume", "linkedin"] }
export function votingDisplayWarning(config: ApplicantDisplayConfig) {
  if (config.fields.some(f => !(liveVotingFields as readonly string[]).includes(f))) return "Choose fields supported by Applicant Display."
  if(config.fields.includes("resume")&&config.fields.includes("experiences"))return "Select résumé or structured experience, rather than duplicating résumé content on the live display."
  if (config.fields.filter(f => f !== "name" && f !== "photo").length > 8) return "Too many fields selected for the live display. Remove one or more fields to keep the candidate view on one screen."
  return null
}
export const votingDisplaySchema = displayConfigSchema.superRefine((config, ctx) => {
  const warning = votingDisplayWarning(config)
  if (warning) ctx.addIssue({ code: z.ZodIssueCode.custom, message: warning })
})
export function readVotingDisplay(value: unknown) {
  return !value || (typeof value === "object" && !Object.keys(value).length) ? structuredClone(defaultVotingDisplay) : displayConfigSchema.parse(value)
}
export function votingJoinPath(sessionId: string, demo = false) {
  z.string().uuid().parse(sessionId)
  return `/voting/${sessionId}/join${demo ? "?demo=1" : ""}`
}

export function votingSessionStage(session:{state:string;joinOpenedAt?:unknown;publishedAt?:unknown}){
  if(session.publishedAt)return "Decisions published"
  if(session.state==="DRAFT")return session.joinOpenedAt?"Lobby · open for joining":"Session setup"
  if(session.state==="OPEN")return "Voting active"
  if(session.state==="COMPLETED")return "Session finished"
  return "Paused · review / next pass"
}
