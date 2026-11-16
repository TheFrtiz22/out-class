import { z } from "zod"
import { EXPERIENCE_HEADINGS, OTHER_SECTION_HEADINGS, RESUME_GPA_SOURCE, RESUME_MONTHS } from "@/lib/resume-import"

/**
 * Deterministic résumé section summary: text lines in, sections out. No model, no network.
 * The contact header (everything above the first recognized heading) is never kept, and
 * e-mail addresses, phone numbers, links and street addresses are removed wherever they appear.
 * Bump RESUME_SUMMARY_PARSER_VERSION whenever the output for the same text can change: cached
 * summaries are keyed by it.
 */
export const RESUME_SUMMARY_PARSER_VERSION = 1
/** Below this the panel says the sections couldn't be read and shows the document only. */
export const RESUME_SUMMARY_MIN_CONFIDENCE = 0.5
export const resumeSectionKinds = ["Education", "Experience", "Leadership", "Projects", "Skills", "Awards", "Certifications", "Other"] as const
export type ResumeSectionKind = typeof resumeSectionKinds[number]

const LIMITS = { sections: 10, items: 6, bullets: 3, metrics: 6, text: 160, heading: 40 }
const text = (max: number) => z.string().min(1).max(max)
const itemSchema = z.object({
  org: text(LIMITS.text).nullable(), role: text(LIMITS.text).nullable(), dates: text(60).nullable(),
  bullets: z.array(text(LIMITS.text)).max(LIMITS.bullets), metrics: z.array(text(60)).max(LIMITS.metrics),
}).strict()
export const resumeSummarySchema = z.object({
  sections: z.array(z.object({ kind: z.enum(resumeSectionKinds), heading: text(LIMITS.heading), items: z.array(itemSchema).min(1).max(LIMITS.items) }).strict()).max(LIMITS.sections),
  confidence: z.number().min(0).max(1),
  parserVersion: z.number().int().positive(),
}).strict()
export type ResumeSummary = z.infer<typeof resumeSummarySchema>
export type ResumeSummaryItem = ResumeSummary["sections"][number]["items"][number]
/** What the panel receives: a readable summary, or a reason to show the document only. */
export type ResumeSummaryResult = { status: "ready"; summary: ResumeSummary } | { status: "unreadable" }
/** Stored JSON never exceeds this (the table's CHECK constraint uses the same bound). */
export const RESUME_SUMMARY_MAX_BYTES = 32_768

export function isReadableSummary(summary: ResumeSummary) {
  return summary.confidence >= RESUME_SUMMARY_MIN_CONFIDENCE && summary.sections.length > 0
}
export function resumeSummaryResult(summary: ResumeSummary): ResumeSummaryResult {
  return isReadableSummary(summary) ? { status: "ready", summary } : { status: "unreadable" }
}

// Heading synonyms, normalized (lower case, "&" → "and", punctuation removed). Includes every
// heading the profile importer recognizes (lib/resume-import.ts).
const SYNONYMS: Record<Exclude<ResumeSectionKind, "Other">, string[]> = {
  Education: ["education", "academic background", "academics", "academic history", "education and honors", "coursework", "relevant coursework"],
  Experience: ["experience", "work experience", "professional experience", "relevant experience", "employment", "employment history", "work history", "internships", "internship experience", "research", "research experience", "professional history"],
  Leadership: ["leadership", "leadership experience", "leadership and activities", "leadership and involvement", "campus involvement", "involvement", "activities", "extracurricular activities", "extracurriculars", "volunteering", "volunteer experience", "community service", "service", "organizations", "student organizations"],
  Projects: ["projects", "selected projects", "personal projects", "academic projects", "technical projects"],
  Skills: ["skills", "technical skills", "skills and interests", "skills and languages", "languages", "tools", "technologies", "competencies", "interests", "additional information", "additional"],
  Awards: ["awards", "honors", "honors and awards", "awards and honors", "achievements", "scholarships", "awards and scholarships"],
  Certifications: ["certifications", "certificates", "licenses", "licenses and certifications", "certifications and licenses"],
}
/** Headings that carry no section worth summarizing (often personal statements or contact data). */
const SKIPPED = new Set(["summary", "professional summary", "objective", "career objective", "profile", "about", "about me", "references", "contact", "contact information", "personal information"])
const KIND_BY_HEADING = new Map<string, ResumeSectionKind>()
for (const [kind, names] of Object.entries(SYNONYMS)) for (const name of names) KIND_BY_HEADING.set(name, kind as ResumeSectionKind)
for (const name of [...EXPERIENCE_HEADINGS, ...OTHER_SECTION_HEADINGS]) if (!KIND_BY_HEADING.has(name)) throw Error(`Unmapped résumé heading: ${name}`)

const normalizeHeading = (line: string) => line.toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim()
const words = (line: string) => line.split(/\s+/).filter(Boolean).length

// Contact data: removed from every kept string, and the header above the first heading is dropped.
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu
const URL_LIKE = /\b(?:https?:\/\/|www\.)\S+|\b(?:linkedin\.com|github\.com|gitlab\.com|behance\.net)\/\S*/gi
const PHONE = /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\b\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g
const STREET = /\b\d{1,6}\s+(?:[NSEW]\.?\s+)?(?:[\p{Lu}\d][\p{L}\d'.-]*\s+){0,4}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Ct|Court|Way|Pl|Place|Ter|Terrace|Cir|Circle|Pkwy|Parkway|Hwy|Highway|Sq|Square)\b\.?(?:,?\s*(?:Apt|Unit|Suite|#)\s*[\w-]+)?/gu
const CITY_STATE_ZIP = /\b[\p{Lu}][\p{L}.' -]{1,30},\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b|\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/gu
export function stripContactDetails(value: string) {
  return value.replace(EMAIL, " ").replace(URL_LIKE, " ").replace(STREET, " ").replace(CITY_STATE_ZIP, " ").replace(PHONE, " ")
    .replace(/\s*(?:[|•·,;]\s*){2,}/g, " | ").replace(/^[\s|•·,;:–—-]+|[\s|•·,;:–—-]+$/g, "").replace(/\s{2,}/g, " ").trim()
}

const MONTH = String.raw`(?:${RESUME_MONTHS}|Sept)[a-z]*\.?`
const SEASON = String.raw`(?:Spring|Summer|Fall|Autumn|Winter)`
const POINT = String.raw`(?:(?:${MONTH}|${SEASON})\s+)?(?:19|20)\d{2}|\d{1,2}\/(?:19|20)?\d{2}`
/** En and em dash, for ranges like "2024–2025". */
const RANGE_DASHES = String.fromCharCode(0x2013, 0x2014)
const DATES = new RegExp(String.raw`(?:(?:Expected|Anticipated|Graduating)\s+)?(?:${POINT})(?:\s*(?:[-${RANGE_DASHES}]|to)\s*(?:${POINT}|Present|Current|Now|Ongoing))?`, "i")
const BULLET = /^(?:[•●▪◦‣∙·*–—-]|o\s)\s*/
const GPA = new RegExp(String.raw`${RESUME_GPA_SOURCE}(?:\s*\/\s*\d(?:\.\d+)?)?`, "i")
const METRICS: RegExp[] = [
  /\b(?:summa|magna)?\s*cum laude\b/gi,
  /\bDean['’]?s List\b/gi,
  /\bPhi Beta Kappa\b/gi,
  /\b(?:Echols|Rodman|Jefferson|Lawn|Ridley|Blue Ridge)\s+Scholar\b/gi,
  /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:[kKmMbB]\b|million\b|billion\b|thousand\b)?/g,
  /\b\d+(?:\.\d+)?\s?%/g,
  /\b\d[\d,]*\+?\s+(?:members|students|users|people|clients|participants|attendees|volunteers|projects|events|customers|downloads|followers|schools|teams|hours|applicants|companies|employees|donors)\b/gi,
  /\b(?:top|ranked)\s+\d+%?(?:\s+of\s+\d[\d,]*)?\b/gi,
]
const clip = (value: string, max = LIMITS.text) => value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value

function metricsOf(values: string[]) {
  const found: string[] = []
  const add = (value: string) => { const v = value.replace(/\s+/g, " ").trim(); if (v && !found.some(f => f.toLowerCase() === v.toLowerCase())) found.push(clip(v, 60)) }
  for (const value of values) {
    const gpa = value.match(GPA); if (gpa) add(gpa[0].replace(/\bgpa\b\s*[:\-]?\s*/i, "GPA "))
    for (const pattern of METRICS) for (const match of value.matchAll(pattern)) add(match[0])
  }
  return found.slice(0, LIMITS.metrics)
}

type Heading = { kind: ResumeSectionKind; heading: string; recognized: boolean; rest: string }
/** A heading line: a known synonym (any case, optional colon), or a short all-caps line. Inline "Skills: …" keeps the rest. */
function headingOf(line: string): Heading | "skip" | null {
  const colon = /^([^:]{2,40}):\s*(.*)$/.exec(line)
  for (const [candidate, rest] of colon ? [[colon[1], colon[2]], [line, ""]] : [[line, ""]]) {
    const name = normalizeHeading(candidate)
    if (!name || words(candidate) > 5) continue
    if (SKIPPED.has(name)) return rest ? null : "skip"
    const kind = KIND_BY_HEADING.get(name)
    if (kind) return { kind, heading: clip(candidate.replace(/\s+/g, " ").trim(), LIMITS.heading), recognized: true, rest: rest.trim() }
  }
  const letters = line.replace(/[^\p{L}]/gu, "")
  if (letters.length >= 4 && letters === letters.toUpperCase() && /^[\p{Lu}\s&/,'’-]+:?$/u.test(line) && words(line) <= 4)
    return { kind: "Other", heading: clip(line.replace(/:$/, "").trim(), LIMITS.heading), recognized: false, rest: "" }
  return null
}
/** pdf.js joins two columns into one line, so a line made only of known headings means the layout interleaves sections. */
function isInterleavedHeadings(line: string) {
  const name = normalizeHeading(line)
  if (words(line) < 2 || KIND_BY_HEADING.has(name)) return false
  let rest = ` ${name} `, hits = 0
  for (const known of [...KIND_BY_HEADING.keys(), ...SKIPPED].sort((a, b) => b.length - a.length)) {
    while (rest.includes(` ${known} `)) { rest = rest.replace(` ${known} `, " "); hits++ }
  }
  return hits >= 2 && !rest.trim()
}

type Draft = { org: string | null; role: string | null; dates: string | null; bullets: string[]; all: string[] }
const emptyDraft = (): Draft => ({ org: null, role: null, dates: null, bullets: [], all: [] })
/** "Charlottesville, VA", "VA", "Remote": locations are left out of entries. */
const LOCATION = /^(?:(?:[\p{Lu}][\p{L}.'-]*\s?){1,3},\s*)?(?:[A-Z]{2}|Remote|Hybrid|USA|United States)$/u
const DETAIL = /\b(?:GPA|Dean['’]?s List|cum laude|Scholar|Honors|Coursework|Minor|Concentration|Thesis)\b/i
const ENTRY_KINDS = new Set<ResumeSectionKind>(["Education", "Experience", "Leadership", "Projects", "Other"])

function entryItems(lines: string[]) {
  const items: Draft[] = []; let current = emptyDraft()
  const flush = () => { if (current.org || current.role || current.bullets.length) items.push(current); current = emptyDraft() }
  for (const raw of lines) {
    const bullet = BULLET.test(raw), line = raw.replace(BULLET, "").trim()
    if (!line) continue
    if (bullet || (line.length > 90 && (current.org || current.role))) {
      current.all.push(line); if (current.bullets.length < LIMITS.bullets) current.bullets.push(clip(line)); continue
    }
    const date = DATES.exec(line)
    const body = (date ? line.replace(date[0], " ") : line).replace(/\s{2,}/g, " ").trim()
    const parts = body.split(/\s*(?:\||•|·|\s[–—-]\s|\t)\s*/).map(v => v.replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, "")).filter(v => v && !LOCATION.test(v))
    // GPA, honors and coursework lines describe the current entry.
    if (!date && current.org && !current.bullets.length && DETAIL.test(line)) { current.all.push(line); current.bullets.push(clip(parts.join(" · ") || line)); continue }
    // A new entry begins after bullets, at a second date, or once the current one has organization, role and dates.
    if (current.bullets.length || (date && current.dates) || (current.org && current.role && current.dates && parts.length)) flush()
    current.all.push(line)
    if (date && !current.dates) current.dates = clip(date[0].replace(/\s+/g, " ").trim(), 60)
    if (current.org && current.role) { const detail = parts.join(" · "); if (detail && current.bullets.length < LIMITS.bullets) current.bullets.push(clip(detail)); continue }
    const rest = [...parts]
    while (rest.length && (!current.org || !current.role)) { const part = rest.shift()!; if (/^GPA\b/i.test(part)) continue; if (!current.org) current.org = clip(part); else current.role = clip(part) }
    if (rest.length && current.bullets.length < LIMITS.bullets) current.bullets.push(clip(rest.join(" · ")))
  }
  flush()
  return items
}
function listItems(kind: ResumeSectionKind, lines: string[]) {
  return lines.map(raw => raw.replace(BULLET, "").trim()).filter(Boolean).map((line): Draft => {
    const labelled = /^([^:]{2,40}):\s*(.+)$/.exec(line), date = kind === "Skills" ? null : DATES.exec(line)
    if (labelled) return { org: clip(labelled[1]), role: null, dates: null, bullets: [clip(labelled[2])], all: [line] }
    const rest = date ? line.replace(date[0], " ").replace(/^[\s,;:()|–—-]+|[\s,;:()|–—-]+$/g, "").replace(/\s{2,}/g, " ") : line
    return kind === "Skills" ? { org: null, role: null, dates: null, bullets: [clip(rest)], all: [line] } : { org: clip(rest || line), role: null, dates: date ? clip(date[0], 60) : null, bullets: [], all: [line] }
  })
}
function mergeSkills(items: Draft[]) {
  // Unlabelled skill lines read as one list item (up to three lines).
  const plain = items.filter(i => !i.org), labelled = items.filter(i => i.org)
  return plain.length ? [...labelled, { org: null, role: null, dates: null, bullets: plain.flatMap(i => i.bullets).slice(0, LIMITS.bullets), all: plain.flatMap(i => i.all) }] : labelled
}

/** Pure: the same lines always give the same summary. */
export function summarizeResumeLines(input: readonly string[]): ResumeSummary {
  const lines = input.map(v => v.replace(/\s+/g, " ").trim()).filter(Boolean)
  const meaningful = lines.join("").replace(/[^\p{L}\p{N}]/gu, "").length
  const sections: { heading: Heading; lines: string[] }[] = []
  let current: { heading: Heading; lines: string[] } | null = null, skipping = false, interleaved = false
  for (const line of lines) {
    if (isInterleavedHeadings(line)) { interleaved = true; continue }
    const heading = headingOf(line)
    if (heading === "skip") { current = null; skipping = true; continue }
    // "Languages: Python, SQL" inside Skills is a labelled line, not a new section.
    if (heading && heading.rest && current && !skipping && current.heading.kind === heading.kind) { current.lines.push(stripContactDetails(line)); continue }
    if (heading) {
      current = { heading, lines: [] }; sections.push(current); skipping = false
      if (heading.rest) { const kept = stripContactDetails(heading.rest); if (kept) current.lines.push(kept) }
      continue
    }
    // Lines above the first heading are the contact header, and lines under a skipped heading stay out.
    if (!current || skipping) continue
    const kept = BULLET.test(line) ? line.replace(BULLET, "").trim() && `• ${stripContactDetails(line.replace(BULLET, ""))}` : stripContactDetails(line)
    if (kept && kept !== "•" && kept.replace(/[^\p{L}\p{N}]/gu, "")) current.lines.push(kept)
  }
  const built = sections.map(({ heading, lines }) => {
    const drafts = ENTRY_KINDS.has(heading.kind) ? entryItems(lines) : heading.kind === "Skills" ? mergeSkills(listItems(heading.kind, lines)) : listItems(heading.kind, lines)
    const items = drafts.slice(0, LIMITS.items).map(d => ({ org: d.org, role: d.role, dates: d.dates, bullets: d.bullets, metrics: metricsOf(d.all) }))
    return { kind: heading.kind, heading: heading.heading, recognized: heading.recognized, items }
  }).filter(s => s.items.length).slice(0, LIMITS.sections)
  const recognized = new Set(built.filter(s => s.recognized).map(s => s.kind)).size
  const entries = built.filter(s => ENTRY_KINDS.has(s.kind)).flatMap(s => s.items)
  const dated = entries.length ? entries.filter(i => i.dates).length / entries.length : 0
  let confidence = meaningful < 20 ? 0 : recognized >= 2 ? Math.min(1, 0.5 + 0.1 * (recognized - 2) + 0.2 * dated) : recognized === 1 ? 0.25 : 0
  if (interleaved) confidence = Math.min(confidence, 0.2)
  return resumeSummarySchema.parse({ sections: built.map(({ recognized: _r, ...section }) => section), confidence: Math.round(confidence * 100) / 100, parserVersion: RESUME_SUMMARY_PARSER_VERSION })
}
export function summarizeResumeText(value: string) {
  return summarizeResumeLines(value.split(/\r?\n/))
}
export const resumeSectionLabel: Record<ResumeSectionKind, string> = { Education: "Education", Experience: "Experience", Leadership: "Leadership & involvement", Projects: "Projects", Skills: "Skills", Awards: "Honors & awards", Certifications: "Certifications", Other: "Other" }
