import { z } from "zod"
import { linkedinUrlSchema, profileSectionSchema, storagePathSchema, type FullStudentProfile } from "@/lib/student-profile"
import { formatPhone, normalizePhone, phoneSchema } from "@/lib/phone"

export const MAX_RESUME_TEXT = 60_000
// Shared with the deterministic section summary (lib/resume-summary.ts).
export const RESUME_MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec"
export const RESUME_GPA_SOURCE = String.raw`\bGPA\s*[:\-]?\s*(\d+(?:\.\d+)?)\b(?![\d.])`
/** En and em dash, for ranges like "2024–2025". */
const RANGE_DASHES = String.fromCharCode(0x2013, 0x2014)
/** A line that is only a year range, e.g. "May 2024 – Present". */
export const resumeYearRangeLine = new RegExp(String.raw`^(?:(?:${RESUME_MONTHS})[a-z]*\s+)?(?:19|20)\d{2}\s*[-${RANGE_DASHES}]\s*(?:(?:[A-Za-z]+\s+)?(?:19|20)\d{2}|present|current)$`, "i")
export const EXPERIENCE_HEADINGS = ["work experience", "professional experience", "experience", "internships", "research", "projects"] as const
export const OTHER_SECTION_HEADINGS = ["education", "skills", "campus involvement", "activities", "leadership", "volunteering", "awards", "certifications", "interests"] as const
const headingLine = (names: readonly string[]) => new RegExp(`^(?:${names.join("|")})\\s*:?\\s*$`, "i")
const experienceHeading = headingLine(EXPERIENCE_HEADINGS), otherHeading = headingLine(OTHER_SECTION_HEADINGS)
export const resumeFields = ["firstName", "lastName", "highSchool", "major", "gradYear", "gpa", "satScore", "actScore", "linkedinUrl", "phone"] as const
export type ResumeField = typeof resumeFields[number]
export const resumeLabels: Record<ResumeField, string> = { firstName: "First name", lastName: "Last name", highSchool: "High school", major: "Major", gradYear: "Graduation year", gpa: "GPA", satScore: "SAT", actScore: "ACT composite", linkedinUrl: "LinkedIn", phone: "Phone" }
const identity = profileSectionSchema.options[0].shape
const education = profileSectionSchema.options[1].shape
export const importPatchSchema = z.object({
  firstName: identity.firstName.optional(), lastName: identity.lastName.optional(),
  highSchool: education.highSchool, major: education.major.optional(), gradYear: education.gradYear.optional(),
  gpa: education.gpa.unwrap().optional(), satScore: z.number().int().min(400).max(1600).optional(),
  actScore: z.number().int().min(1).max(36).optional(),
  linkedinUrl: linkedinUrlSchema.optional(), phone: phoneSchema.optional(),
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
  return Object.fromEntries([...resumeFields, "resumeUrl" as const].map(field => [field, profile[field] ?? null]))
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
// ─── Layout reading ───────────────────────────────────────────────────────────
// PDF text arrives one visual line per line; right-aligned columns (dates, places) are joined to
// the line with two or more spaces. Everything below is deterministic: no model, no network.
const MONTH = String.raw`(?:${RESUME_MONTHS})[a-z]*\.?`
const SEASON = String.raw`(?:Spring|Summer|Fall|Autumn|Winter)`
const DATE = String.raw`(?:(?:${MONTH}|${SEASON})\s+)?(?:19|20)\d{2}`
const DASH = String.raw`(?:-|${RANGE_DASHES.split("").join("|")}|to)`
const PERIOD = String.raw`(?:(?:Expected|Anticipated)\s+)?${DATE}(?:\s*${DASH}\s*(?:${DATE}|present|current|now))?`
/** A trailing date or date range, e.g. "Engineering Intern   June 2025 – Aug 2025". */
const trailingPeriod = new RegExp(String.raw`^(.*?)[\s,|(]*(${PERIOD})\)?$`, "i")
const periodOnly = new RegExp(String.raw`^${PERIOD}$`, "i")
const bulletLine = /^[•▪◦●○■□➢►✓*·\-–—]\s*/
/** "Charlottesville, VA", "Remote" in a right-hand column. */
const locationColumn = /\s{2,}(?:[\p{L}.' -]+,\s*(?:[A-Z]{2}|[\p{L} ]+)|Remote|Hybrid)$/u
const ROLE = /\b(?:intern|assistant|member|delegate|president|vice president|captain|analyst|representative|lead|leader|chair|chairperson|director|engineer|developer|researcher|volunteer|tutor|coordinator|officer|treasurer|secretary|founder|co-founder|manager|associate|fellow|consultant|ambassador|mentor|instructor|counselor|editor|writer|designer|head|organizer|staff|scholar|apprentice|cashier|server|lifeguard|tester)s?\b/i
type SectionKind = "education" | "experience" | "other"
const SECTION_KEYWORDS: [SectionKind, RegExp][] = [
  ["education", /\b(?:education|academic|academics)\b/],
  ["experience", /\b(?:experience|employment|work history|internships?|research|projects?|leadership|involvement|activities|extracurriculars?|volunteer(?:ing)?|service|organizations)\b/],
  ["other", /\b(?:skills|awards|honors|certifications?|licenses|interests|languages|summary|objective|profile|references|coursework|publications|additional|technologies|tools)\b/],
]
const normalizeHeading = (line: string) => line.toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim()
const HEADING_WORDS = new Set("and academic academics achievements activities additional awards background campus certificates certification certifications community competencies course coursework education employment experience experiences extracurricular extracurriculars highlights history honors information interests internship internships involvement languages leadership licenses objective organizations other personal profile professional project projects publications qualifications references relevant research scholarships selected service skills student summary technical technologies tools volunteer volunteering work".split(" "))
/**
 * A section heading: a short line made only of section words ("Campus Involvement", "WORK EXPERIENCE").
 * Organizations and roles in capitals ("NASA", "Research Aide") never qualify.
 */
function headingKind(line: string): SectionKind | null {
  if (line.length > 50 || /\d|@/.test(line) || !/^\p{Lu}/u.test(line)) return null
  const words = normalizeHeading(line).split(" ").filter(Boolean)
  if (!words.length || words.length > 5 || !words.every(word => HEADING_WORDS.has(word))) return null
  const text = words.join(" ")
  for (const [kind, pattern] of SECTION_KEYWORDS) if (pattern.test(text)) return kind
  return "other"
}
const titleCase = (value: string) => value === value.toUpperCase() ? value.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase()) : value
const clean = (value: string) => value.replace(/\s+/g, " ").replace(/^[\s,;:|·•\-–—]+|[\s,;:|·•\-–—(]+$/g, "").trim()
const ROLE_SPLIT = /\s*,\s*|\s+[—–]\s+|\s+-\s+|\s+\|\s+|\s+at\s+/
/** "Research Assistant, Policy Lab" or "Model UN — Delegate": the side naming a role is the title. */
function splitRoleAndOrg(text: string): { title: string; subtitle: string } | null {
  const match = ROLE_SPLIT.exec(text)
  if (!match || match.index === 0) return null
  const first = clean(text.slice(0, match.index)), second = clean(text.slice(match.index + match[0].length))
  if (!first || !second) return null
  return ROLE.test(second) && !ROLE.test(first) ? { title: second, subtitle: first } : { title: first, subtitle: second }
}

/** Reads one résumé's text into reviewable profile suggestions. Unsupported sections remain warnings, never hidden writes. */
export function extractResumeProposal(text: string): ResumeExtraction {
  if (text.length > MAX_RESUME_TEXT) throw Error("The PDF contains too much text. Choose a shorter résumé.")
  if (text.replace(/[^\p{L}\p{N}]/gu, "").length < 20) throw Error("No meaningful text was found. Scanned/image-only PDFs are not supported; upload a text-based PDF.")
  const lines = text.split(/\r?\n/).map(v => v.replace(/[ \t]/g, "  ").replace(/\s+$/, "").replace(/^\s+/, "")).filter(Boolean)
  const fields: ResumeExtraction["fields"] = resumeFields.map(field => ({ field, status: "missing", value: null, note: "Not found. Your existing value will stay unchanged." }))
  const numeric = (field: ResumeField) => ["gradYear", "gpa", "satScore", "actScore"].includes(field)
  function propose(field: ResumeField, values: string[], uncertain = false, note?: string) {
    const unique = [...new Set(values.map(v => v.trim()).filter(Boolean))]
    const result = fields.find(v => v.field === field)!
    if (!unique.length) return
    const value = unique[0]
    const check = importPatchSchema.safeParse({ [field]: numeric(field) ? Number(value) : value })
    if (!check.success) { result.status = "uncertain"; result.note = "A possible value was outside profile limits. Enter the correct value manually."; return }
    result.value = value; result.status = unique.length > 1 || uncertain ? "uncertain" : "found"
    result.note = unique.length > 1 ? "Multiple values found; review this suggestion carefully." : note ?? (uncertain ? "Inferred from the document heading; verify before accepting." : "Review before accepting.")
  }
  const matches = (pattern: RegExp, source = text) => [...source.matchAll(pattern)].map(m => m[1])

  // Sections: each line belongs to the most recent heading above it.
  const kinds: (SectionKind | "header")[] = []
  let current: SectionKind | "header" = "header"
  const isHeading = lines.map((line, i) => { const kind = i === 0 ? null : headingKind(line); if (kind) current = kind; kinds.push(current); return !!kind })
  const inSection = (kind: SectionKind) => lines.filter((_, i) => kinds[i] === kind && !isHeading[i])
  const header = lines.filter((_, i) => kinds[i] === "header")
  const education = inSection("education")

  // Name: the first line, before any contact details on the same line.
  const firstLine = lines[0]?.replace(/^name\s*:\s*/i, "").split(/\s{2,}|\s*[|·•]\s*|\s+[—–]\s+/)[0]?.trim()
  if (firstLine && /^[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){1,4}$/u.test(firstLine) && !/university|resume|résumé|curriculum|education/i.test(firstLine)) {
    const parts = titleCase(firstLine).split(/\s+/).filter(part => !/^\p{L}\.?$/u.test(part))
    if (parts.length >= 2) { propose("firstName", [parts[0]], true); propose("lastName", [parts.slice(1).join(" ")], true) }
  }

  // Contact details live in the header, above the first section.
  const headerText = header.join("\n")
  const linkedin = matches(/((?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/in\/[A-Za-z0-9_%-]{2,100})\/?/gi, text).map(v => `https://www.linkedin.com/in/${v.replace(/^.*\/in\//i, "")}`)
  propose("linkedinUrl", linkedin, false, "Review before accepting.")
  const phones = matches(/(?:^|[^\d+])((?:\+?1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-]?[2-9]\d{2}[\s.-]?\d{4})(?!\d)/g, headerText).flatMap(v => { try { return [formatPhone(normalizePhone(v))] } catch { return [] } })
  propose("phone", phones, false, "Shared only with clubs that accept you. Review before accepting.")

  // Education: labelled values, degree lines and the dates beside them.
  const educationText = (education.length ? education : lines).join("\n")
  const degree = /\b(?:Bachelor(?:'s|’s)?(?:\s+of\s+(?:Science|Arts|Engineering|Applied Science|Business Administration|Fine Arts|Music|Architecture|Science in Engineering))?|B\.\s?S\.(?:\s?E\.)?|B\.\s?A\.|BSE|B\.?S\.?|B\.?A\.?|BBA|B\.\s?Eng\.?)(?:\s*\([A-Z.]{2,8}\))?(?:\s*,\s*|\s+in\s+|\s*:\s*|\s+)(\p{Lu}[^,;|(\n]{1,120})/gu
  const majorValues = [
    ...matches(/\b(?:intended\s+)?major\s*:\s*([^\n|;]{1,200})/gi),
    ...matches(degree, educationText).map(v => clean(v.split(/\s{2,}|\s+[—–-]\s+|,?\s+minor\b|\s+(?:expected|anticipated)\b/i)[0].replace(trailingPeriod, "$1"))),
  ].map(clean).filter(v => v && v.length <= 200 && !/^(?:in|of|degree|candidate)$/i.test(v))
  propose("major", majorValues)
  const highSchools = [
    ...matches(/\bhigh school\s*[:\-]\s*([^\n]{1,200})/gi),
    ...education.flatMap(line => { const m = /([\p{Lu}][\p{L}.'&\- ]{0,150}?\bHigh School)\b/u.exec(line.split(/\s{2,}|\s*\|\s*|\s+[—–]\s+/).find(part => /high school/i.test(part)) || ""); return m && !/^high school$/i.test(m[1].trim()) ? [m[1]] : [] }),
  ]
  propose("highSchool", highSchools.map(clean))
  const labelledYears = matches(/\b(?:graduation(?:\s+(?:year|date))?|expected graduation|anticipated graduation|class of|expected|anticipated)\s*[:\-]?\s*(?:(?:[A-Za-z]+\.?)\s+)?(20\d{2})\b/gi, educationText)
  // A lone date beside a university or degree line (not a range, not high school) is when that degree ends.
  const datedYears = education.flatMap(line => {
    if (/high school/i.test(line) || !/universit|college|institute|school of|bachelor|\bB\.?\s?[AS]\b|degree|candidate/i.test(line)) return []
    const m = trailingPeriod.exec(line)
    return m && !new RegExp(DASH, "i").test(m[2].replace(/^(?:expected|anticipated)\s+/i, "")) ? [m[2].slice(-4)] : []
  })
  if (labelledYears.length) propose("gradYear", labelledYears)
  else propose("gradYear", datedYears, false, "From the date beside your degree. Review before accepting.")
  propose("gpa", matches(new RegExp(RESUME_GPA_SOURCE, "gi")))
  const scales = [...text.matchAll(/\bGPA\s*[:\-]?\s*\d+(?:\.\d+)?\s*\/\s*(\d+(?:\.\d+)?)/gi)];
  if (scales.some(match => Number(match[1]) !== 4)) {
    const gpa = fields.find(v => v.field === "gpa")!; gpa.status = "uncertain"; gpa.value = null; gpa.note = "A non-4.0 GPA scale was found. Enter a verified value on the supported scale manually."
  }
  propose("satScore", matches(/\bSAT(?:\s+(?:score|composite))?\s*[:\-]?\s*(\d{3,4})\b/gi))
  propose("actScore", matches(/\bACT(?:\s+(?:score|composite))?\s*[:\-]?\s*(\d{1,2})\b/gi))

  // Experience, research, projects, leadership and activities: title, organization and period.
  const experiences: ResumeExtraction["experiences"] = []
  const add = (title: string, subtitle: string, period: string) => {
    const entry = { title: clean(title), subtitle: clean(subtitle), period: clean(period) }
    if (experiences.length < 50 && importExperienceSchema.safeParse([entry]).success && !experiences.some(e => e.title === entry.title && e.subtitle === entry.subtitle && e.period === entry.period)) experiences.push(entry)
  }
  let pending: string[] = []
  for (let i = 0; i < lines.length; i++) {
    if (kinds[i] !== "experience" || isHeading[i]) { pending = []; continue }
    const line = lines[i]
    if (bulletLine.test(line)) { pending = []; continue }
    const pipes = line.split(/\s*[|•]\s*/)
    if (pipes.length === 3 && /\b(?:19|20)\d{2}\b/.test(pipes[2])) { add(pipes[0], pipes[1], pipes[2]); pending = []; continue }
    const dated = trailingPeriod.exec(line)
    const body = clean((dated ? dated[1] : line).replace(locationColumn, ""))
    // A sentence (a description without a bullet) is never a title or an organization.
    if (body.split(" ").length > 12) { pending = []; continue }
    if (!dated) { pending.push(body); if (pending.length > 2) pending.shift(); continue }
    const period = dated[2]
    if (!body) {
      // Period on a line of its own, under "Title / Organization" or "Title, Organization".
      const split = pending.length === 1 ? splitRoleAndOrg(pending[0]) : null
      if (split) add(split.title, split.subtitle, period)
      else if (pending.length === 2) add(pending[0], pending[1], period)
      pending = []; continue
    }
    const split = splitRoleAndOrg(body)
    if (split) { add(split.title, split.subtitle, period); pending = []; continue }
    const before = pending[pending.length - 1]
    if (before) {
      // "Organization   City, ST" then "Title   Dates" (or the other way round).
      const swap = ROLE.test(before) && !ROLE.test(body)
      add(swap ? before : body, swap ? body : before, period); pending = []; continue
    }
    // "Organization   Dates" then "Title" on the next line.
    const next = lines[i + 1]
    if (next && kinds[i + 1] === "experience" && !isHeading[i + 1] && !bulletLine.test(next) && !trailingPeriod.test(next)) {
      const nextBody = clean(next.replace(locationColumn, ""))
      const swap = ROLE.test(body) && !ROLE.test(nextBody)
      add(swap ? body : nextBody, swap ? nextBody : body, period); i++
    }
    pending = []
  }
  return extractionSchema.parse({ fields, experiences, warnings: ["Check names, dates and scores before saving; unrecognized information is not imported.", "Skills, descriptions and bio have no import mapping; add them in Edit profile.", ...(experiences.length ? ["Experience suggestions add to your existing entries."] : ["No experience entries were recognized. You can add title, organization and period manually below."])] })
}

/**
 * Suggestions ticked for the student at the start of review: confident values for fields that are
 * still empty. Anything already on the profile, or uncertain, waits for an explicit tick.
 */
export function preselectedFields(fields: ResumeExtraction["fields"], baseline: Record<string, unknown>): ResumeField[] {
  return fields.filter(item => item.status === "found" && item.value && (baseline[item.field] === null || baseline[item.field] === undefined || baseline[item.field] === "")).map(item => item.field)
}

export type OnboardingPrefill = {
  academic: Partial<Record<"major" | "gradYear" | "gpa" | "satScore" | "actScore" | "phone", string>>
  linkedinUrl?: string
  experiences: { title: string; subtitle: string; period: string }[]
}
/**
 * Sign-up form values from a résumé: confident suggestions only, within the sign-up form's own
 * limits (major and experience text up to 120 characters, at most 20 entries, offered years only).
 */
export function onboardingPrefill(proposal: ResumeExtraction, graduationYears: string[]): OnboardingPrefill {
  const found = (field: ResumeField) => { const item = proposal.fields.find(v => v.field === field); return item?.status === "found" && item.value ? item.value : undefined }
  const academic: OnboardingPrefill["academic"] = {}
  const major = found("major"); if (major && major.length <= 120) academic.major = major
  const gradYear = found("gradYear"); if (gradYear && graduationYears.includes(gradYear)) academic.gradYear = gradYear
  const gpa = found("gpa"); if (gpa && /^\d(?:\.\d{1,3})?$/.test(gpa)) academic.gpa = gpa
  for (const field of ["satScore", "actScore", "phone"] as const) { const value = found(field); if (value) academic[field] = value }
  const experiences = proposal.experiences.filter(v => v.title.length <= 120 && v.subtitle.length <= 120 && v.period.length >= 1).slice(0, 20)
  return { academic, linkedinUrl: found("linkedinUrl"), experiences }
}
