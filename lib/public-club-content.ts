/**
 * Public club profiles show what a club says about itself, never research notes about it.
 * Rule: an unknown field is hidden, not described as unknown.
 *
 * Two strengths, on purpose:
 * - `cleanPublicMarketing` / `cleanPublicProfile` remove research-note sentences broadly. They
 *   run only where a person reviews the result: the import packages in docs/club-profile-design
 *   and scripts/clean-public-club-profiles.cjs (dry run by default).
 * - `presentPublicMarketing` runs on every render. It is narrow (placeholder values, source
 *   links, and the exact boilerplate sentences of the research packages), so it can never
 *   delete a sentence a club leader wrote, such as "We study historical preservation."
 */

// A sentence or clause matching any of these is a note about sources, uncertainty or
// OutClass itself rather than club content.
const researchNote = [
  /\bnot (?:yet |been |publicly )?(?:verified|confirmed|published|disclosed|supplied|specified|asserted)\b/i,
  /\b(?:un)?verified\b/i, /\bcurrent recruiting page\b/i, /\bofficial site\b/i, /\bplacement (?:page|collage)\b/i,
  /\bhistorical\b/i, /\bguarantee[ds]?\b/i, /\bindependently\b/i, /\baudited\b/i,
  /\bwebsite[- ](?:reported|figures|claims)\b/i, /\bpublished website claims\b/i,
  /\brequire[s]? confirmation\b/i, /\bshould be confirmed\b/i, /^\s*(?:confirm|consult|check|review|see the|use the official)\b/i,
  /\bOutClass\b/, /\breviewed sources\b/i, /\bsources reviewed\b/i, /\bno estimate\b/i, /\breliable published\b/i,
  /\bInclusion is independent\b/i, /\bnot (?:treated|represented|counted)\b/i, /\bdistinct from\b/i, /\bdistinguishes\b/i,
  /\bnot (?:consulting )?clients\b/i, /\bnot member employers\b/i, /\bnot (?:a|the) (?:forecast|current)\b/i,
  /\bmember employers\b/i, /\bmember placement\b/i, /\bplacement (?:claim|rate|list)\b/i,
  /\bno (?:precise|numeric|current|verified|reliable)\b/i, /\bconflicting\b/i, /\bpage metadata\b/i, /\bneed final\b/i,
  /\bundated\b/i, /\bapproximate (?:and|club acceptance)\b/i, /\bpublished AUM\b/i, /\bcurrent dated figure\b/i,
  /\bemployer logos\b/i, /\bemployer participation\b/i, /\bsponsors are not\b/i, /\bconcerns McIntire admission\b/i,
  /\bdeadline (?:of|was)\b/i, /\bthat (?:date|deadline) has passed\b/i, /\bdoes not establish\b/i, /\btimeline\b/i,
  /\bmay apply\b/i, /\bweekly hours\b/i, /\bspring (?:participation|intake)\b/i, /\bdocumented spring recruitment\b/i,
  /\bmailing-list records\b/i, /\bshortlist\b/i, /\bmember biographies\b/i, /\bofficial-site\b/i, /\bnot found\b/i,
  /^\s*(?:these are|neither|it is historical)\b/i, /^\s*(?:not disclosed|not published|unknown|n\/a|tbd)\b/i,
]

/** Phrases that mean "we don't know" when a whole field value consists of them. */
const unknownValue = /^\s*(?:not (?:publicly )?(?:published|disclosed|available)|unknown|n\/a|tbd|none published|ask the club)\b/i

const attribution = /,?\s*per (?:the )?[^.;]*?(?:site|listing|page)(?: copy)?\b/gi

export function isResearchNote(text: string): boolean {
  return researchNote.some(pattern => pattern.test(text))
}

function capitalize(text: string) {
  return text ? text[0].toUpperCase() + text.slice(1) : text
}

/** Removes research-note sentences and clauses; returns "" when nothing club-authored remains. */
export function cleanPublicText(value: string | null | undefined, extra: RegExp[] = []): string {
  if (!value) return ""
  if (unknownValue.test(value)) return ""
  // Keep abbreviations such as "J.P. Morgan" and "St. Anne's" intact when splitting sentences.
  const protectedText = value.replace(/\b(J\.P|St|U\.S|Inc|Co|Jr|Sr|Dr|Mr|Ms|No|vs|H\.E\.R)\./g, "$1․")
  return protectedText
    .split(/\n{2,}/)
    .map(paragraph => paragraph
      .split(/(?<=[.!?])\s+(?=[A-Z0-9“"‘'])/)
      .map(sentence => {
        if (extra.some(pattern => pattern.test(sentence))) return ""
        const clauses = sentence.split(/;\s+/).filter(clause => !isResearchNote(clause))
        if (!clauses.length) return ""
        let kept = clauses.join("; ").replace(attribution, "").trim()
        if (!kept) return ""
        if (!/[.!?:]$/.test(kept) && /[.!?]$/.test(sentence.trim())) kept += "."
        return capitalize(kept)
      })
      .filter(Boolean)
      .join(" "))
    .filter(Boolean)
    .join("\n\n")
    .replace(/․/g, ".")
    .trim()
}

const researchLink = /^\s*(?:research source\b|source \d|placement evidence\b)/i
const sectionTitle = (title: string) => capitalize(title.replace(/^(?:documented|club-reported|published)\s+(?:historical\s+)?/i, "").replace(/^historical\s+/i, "").replace(/\s+evidence$/i, "").trim())
const metricLabel = (label: string) => label.replace(/\s*\((?:club |chapter |official )?(?:website|site)\)\s*/i, "").trim()
// When a profile lists member destinations, a prose copy of the same list is redundant.
const destinationSentence = /^Selected club-reported (?:internship|member)[^:]*:/

type Loose = Record<string, unknown>
const record = (value: unknown): Loose => value && typeof value === "object" && !Array.isArray(value) ? value as Loose : {}
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const text = (value: unknown) => typeof value === "string" ? value : ""

/**
 * Returns a copy of a club's marketing JSON with research notes, source links and
 * "unknown" placeholders removed. Unknown keys and club-authored content are kept as they are.
 */
export function cleanPublicMarketing<T>(marketing: T): T {
  const source = record(marketing)
  if (!Object.keys(source).length) return marketing
  const out: Loose = { ...source }
  const sentenceRules = list(source.placements).length ? [destinationSentence] : []
  if ("sections" in source) out.sections = list(source.sections).map(value => {
    const section = record(value)
    const cards = list(section.cards).map(card => ({ ...record(card), description: cleanPublicText(text(record(card).description)) }))
    return { ...section, title: sectionTitle(text(section.title)), body: cleanPublicText(text(section.body), sentenceRules), cards }
  }).filter(section => section.body || section.cards.length)
  if ("faqs" in source) out.faqs = list(source.faqs).map(value => ({ ...record(value), answer: cleanPublicText(text(record(value).answer)) }) as Loose)
    .filter(faq => faq.answer && !isResearchNote(text(faq.question)))
  if ("links" in source) out.links = list(source.links).filter(value => !researchLink.test(text(record(value).label)))
  if ("metrics" in source) out.metrics = list(source.metrics).map(value => ({ ...record(value), label: metricLabel(text(record(value).label)) }) as Loose)
    .filter(metric => metric.label && text(metric.value) && !unknownValue.test(text(metric.value)))
  for (const key of ["commitment", "eligibility", "dues", "acceptanceNote"]) if (key in source) out[key] = cleanPublicText(text(source[key]))
  // The page labels destinations "Club-reported"; per-club caveats about them are research notes.
  if ("outcomesNote" in source) out.outcomesNote = ""
  if ("acceptanceSource" in source) out.acceptanceSource = ""
  for (const key of ["benefits", "accolades", "placements"]) if (key in source) out[key] = list(source[key]).filter(item => typeof item === "string" && item.trim() && !isResearchNote(item))
  return out as T
}

/** Profile-level text (tagline and description) uses the same rules. */
export function cleanPublicProfile<T extends { tagline?: string; description?: string; marketing?: unknown }>(profile: T): T {
  return {
    ...profile,
    ...(profile.tagline !== undefined ? { tagline: cleanPublicText(profile.tagline) } : {}),
    ...(profile.description !== undefined ? { description: cleanPublicText(profile.description) } : {}),
    ...(profile.marketing !== undefined ? { marketing: cleanPublicMarketing(profile.marketing) } : {}),
  }
}

/** Exact boilerplate sentences from the 2026-10 research packages (safe to hide on render). */
const packageBoilerplate = new Set([
  "Inclusion is independent of recruiting season.",
  "Current application dates and intake policy require confirmation on the club’s own channels.",
  "Historical fall or spring evidence is not a current opening.",
  "No native application is currently enabled on OutClass.",
  "Check the linked club page for current recruitment and membership instructions.",
  "A reliable published club acceptance rate was not found in the reviewed sources.",
  "No estimate is substituted.",
  "Upcoming spring dates are not verified.",
  "Consult the official recruitment page before relying on a deadline.",
  "Use the official website and links on this profile.",
  "An OutClass listing does not mean native applications are open.",
  "These are historical destinations, not placement guarantees.",
  "Previously documented spring recruitment.",
  "Dates for the next cycle are not yet verified.",
])
const placeholderNote = /\b(?:sources? reviewed|reviewed sources|no verified|not (?:publicly )?(?:published|disclosed|specified)|guarantee[ds]?|official-site index|research source)\b/i

function withoutBoilerplate(value: string) {
  return value.split(/(?<=[.!?])\s+/).filter(sentence => !packageBoilerplate.has(sentence.trim())).join(" ").trim()
}
const directive = /^\s*(?:confirm|consult|check) (?:current|the club|with)\b/i
// Short fields ("Who can join", "Membership dues") keep only clauses that are not placeholders.
const presentField = (value: unknown) => {
  const kept = text(value).split(/;\s+/).map(clause => clause.trim())
    .filter(clause => clause && !unknownValue.test(clause) && !placeholderNote.test(clause) && !directive.test(clause))
  const field = kept.join("; ")
  return field && !/[.!?]$/.test(field) && /[.!?]$/.test(text(value).trim()) ? `${capitalize(field)}.` : capitalize(field)
}

/** Render-time view of a profile's marketing JSON: hides unknown placeholders and research links. */
export function presentPublicMarketing<T>(marketing: T): T {
  const source = record(marketing)
  if (!Object.keys(source).length) return marketing
  const out: Loose = { ...source, acceptanceSource: "" }
  if ("sections" in source) out.sections = list(source.sections).map(value => ({ ...record(value), body: withoutBoilerplate(text(record(value).body)) }) as Loose)
    .filter(section => section.body || list(section.cards).length)
  if ("faqs" in source) out.faqs = list(source.faqs).map(value => ({ ...record(value), answer: withoutBoilerplate(text(record(value).answer)) })).filter(faq => faq.answer)
  if ("links" in source) out.links = list(source.links).filter(value => !researchLink.test(text(record(value).label)))
  if ("metrics" in source) out.metrics = list(source.metrics).filter(value => text(record(value).value).trim() && !unknownValue.test(text(record(value).value)))
  for (const key of ["commitment", "eligibility", "dues", "outcomesNote", "acceptanceNote"]) if (key in source) out[key] = presentField(source[key])
  return out as T
}
