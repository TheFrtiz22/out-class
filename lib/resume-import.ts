import { z } from "zod"
import { profileSectionSchema, storagePathSchema, type FullStudentProfile } from "@/lib/student-profile"

export const MAX_RESUME_TEXT = 60_000
export const resumeFields = ["firstName", "lastName", "major", "gradYear", "gpa", "satScore", "actScore"] as const
export type ResumeField = typeof resumeFields[number]
export const resumeLabels: Record<ResumeField, string> = { firstName: "First name", lastName: "Last name", major: "Major", gradYear: "Graduation year", gpa: "GPA", satScore: "SAT", actScore: "ACT composite" }
const identity = profileSectionSchema.options[0].shape
const education = profileSectionSchema.options[1].shape
export const importPatchSchema = z.object({
  firstName: identity.firstName.optional(), lastName: identity.lastName.optional(),
  major: education.major.optional(), gradYear: education.gradYear.optional(),
  gpa: z.number().min(0).max(4).optional(), satScore: z.number().int().min(400).max(1600).optional(),
  actScore: z.number().int().min(1).max(36).optional(),
}).strict()
export const importExperienceSchema = profileSectionSchema.options[2].shape.experiences
export const extractionSchema = z.object({
  fields: z.array(z.object({ field: z.enum(resumeFields), status: z.enum(["found", "missing", "uncertain"]), value: z.string().max(200).nullable(), note: z.string().max(300) }).strict()).length(resumeFields.length).refine(v => new Set(v.map(f => f.field)).size === resumeFields.length),
  experiences: importExperienceSchema,
  warnings: z.array(z.string().max(300)).max(10),
}).strict().superRefine((result, ctx) => {
  for (const item of result.fields) {
    if (item.status === "missing" && item.value !== null) ctx.addIssue({ code: "custom", message: "Missing fields must not have values" });
    if (item.status === "found" && item.value === null) ctx.addIssue({ code: "custom", message: "Found fields require a value" });
    if (item.value !== null) {
      const numeric = ["gradYear", "gpa", "satScore", "actScore"].includes(item.field);
      if (!importPatchSchema.safeParse({ [item.field]: numeric ? Number(item.value) : item.value }).success || (numeric && !item.value.trim())) ctx.addIssue({ code: "custom", message: "Invalid proposed profile value" });
    }
  }
})
export type ResumeExtraction = z.infer<typeof extractionSchema>
export function importBaseline(profile: FullStudentProfile) {
  return Object.fromEntries([...resumeFields, "resumeUrl" as const].map(field => [field, profile[field]]))
}
export const confirmImportSchema = z.object({
  patch: importPatchSchema,
  experiences: importExperienceSchema,
  baseline: z.record(z.enum([...resumeFields, "resumeUrl"]), z.union([z.string().max(500), z.number(), z.null()])),
  resumeReference: storagePathSchema.refine(v => !!v).optional(),
}).strict()
export function reviewPatch(values: Partial<Record<ResumeField, string>>, selected: ResumeField[]) {
  return importPatchSchema.parse(Object.fromEntries(selected.map(field => [field, ["gradYear", "gpa", "satScore", "actScore"].includes(field) ? (values[field]?.trim() ? Number(values[field]) : NaN) : values[field]])))
}
/** Conservative, deterministic mapping. Unsupported sections remain warnings, never hidden writes. */
export function extractResumeProposal(text: string): ResumeExtraction {
  if (text.length > MAX_RESUME_TEXT) throw Error("The PDF contains too much text. Choose a shorter résumé.")
  if (text.replace(/[^\p{L}\p{N}]/gu, "").length < 20) throw Error("No meaningful text was found. Scanned/image-only PDFs are not supported; upload a text-based PDF.")
  const lines = text.split(/\r?\n/).map(v => v.trim()).filter(Boolean)
  const fields: ResumeExtraction["fields"] = resumeFields.map(field => ({ field, status: "missing", value: null, note: "Not found. Your existing value will stay unchanged." }))
  function propose(field: ResumeField, values: string[], uncertain = false) {
    const unique = [...new Set(values.map(v => v.trim()))]
    const result = fields.find(v => v.field === field)!
    if (!unique.length) return
    const value = unique[0]
    const check = importPatchSchema.safeParse({ [field]: ["gradYear", "gpa", "satScore", "actScore"].includes(field) ? Number(value) : value })
    if (!check.success) { result.status = "uncertain"; result.note = "A possible value was outside profile limits. Enter the correct value manually."; return }
    result.value = value; result.status = unique.length > 1 || uncertain ? "uncertain" : "found"
    result.note = unique.length > 1 ? "Multiple values found; review this suggestion carefully." : uncertain ? "Inferred from the document heading; verify before accepting." : "Review before accepting."
  }
  const matches = (pattern: RegExp) => [...text.matchAll(pattern)].map(m => m[1])
  const name = lines[0]?.replace(/^name\s*:\s*/i, "")
  if (name && /^[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){1,3}$/u.test(name) && !/university|resume|résumé|education/i.test(name)) {
    const parts = name.split(/\s+/); propose("firstName", [parts[0]], true); propose("lastName", [parts.slice(1).join(" ")], true)
  }
  propose("major", matches(/\bmajor\s*:\s*([^\n|;]{1,200})/gi))
  propose("gradYear", matches(/\b(?:graduation(?:\s+year)?|expected graduation|class of)\s*[:\-]?\s*(?:[A-Za-z]+\s+)?(20\d{2})\b/gi))
  propose("gpa", matches(/\bGPA\s*[:\-]?\s*(\d(?:\.\d{1,3})?)\b(?:\s*\/\s*4(?:\.0)?)?/gi))
  if (/\bGPA\s*[:\-]?\s*\d(?:\.\d+)?\s*\/\s*(?!4(?:\.0)?(?:\D|$))\d/i.test(text)) {
    const gpa = fields.find(v => v.field === "gpa")!; gpa.status = "uncertain"; gpa.value = null; gpa.note = "A non-4.0 GPA scale was found. Enter a verified value on the supported scale manually."
  }
  propose("satScore", matches(/\bSAT(?:\s+(?:score|composite))?\s*[:\-]?\s*(\d{3,4})\b/gi))
  propose("actScore", matches(/\bACT(?:\s+(?:score|composite))?\s*[:\-]?\s*(\d{1,2})\b/gi))
  const experiences: ResumeExtraction["experiences"] = []
  let inExperience = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^(?:work experience|professional experience|experience|internships|research|projects)\s*:?\s*$/i.test(line)) { inExperience = true; continue }
    if (/^(?:education|skills|campus involvement|activities|leadership|volunteering|awards|certifications|interests)\s*:?\s*$/i.test(line)) { inExperience = false; continue }
    if (!inExperience) continue
    const parts = line.split(/\s*[|•]\s*/)
    if (parts.length === 1 && lines[i + 1] && /^(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+)?(?:19|20)\d{2}\s*[-–—]\s*(?:(?:[A-Za-z]+\s+)?(?:19|20)\d{2}|present|current)$/i.test(lines[i + 2] || "")) {
      const entry = { title: line, subtitle: lines[i + 1], period: lines[i + 2] }
      if (importExperienceSchema.safeParse([entry]).success && experiences.length < 50) { experiences.push(entry); i += 2 }
      continue
    }
    if (parts.length === 3 && /\b(?:19|20)\d{2}\b/.test(parts[2])) {
      const entry = { title: parts[0], subtitle: parts[1], period: parts[2] }
      if (importExperienceSchema.safeParse([entry]).success && experiences.length < 50) experiences.push(entry)
    }
  }
  return extractionSchema.parse({ fields, experiences, warnings: ["Extraction is conservative. Check names, dates and scores; unrecognized information is not imported.", "Skills, institution/degree details, descriptions, bio and campus involvement have no supported import mapping.", ...(experiences.length ? ["Experience suggestions need review and will append to your existing entries."] : ["No structured experience entries were recognized. You can add title, organization and period manually below."])] })
}
