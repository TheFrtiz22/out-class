"use client"

import Image from "next/image"
import { ClubLogo } from "@/components/club-logo"
import { clubAssetSource } from "@/lib/club-assets"
import type { ReactNode } from "react"
import { Globe, Instagram, Linkedin, Mail, ExternalLink, Check, Play } from "@/components/icons"
import "@/components/clubs/profile-presentation.css"
import { profileStatistics, readMarketing, type ClubMarketing, type ClubProfileDraft } from "@/lib/club-marketing"
import { presentPublicMarketing } from "@/lib/public-club-content"
import { employerMark, SHOW_EMPLOYER_MARKS } from "@/lib/employer-marks"

/** The public view of a profile's marketing: unknown placeholders and research links hidden. */
export function publicMarketing(value: unknown): ClubMarketing {
  return presentPublicMarketing(readMarketing(value))
}

function socials(m: ClubMarketing) {
  return [
    { label: "Website", url: m.website, icon: Globe },
    { label: "LinkedIn", url: m.linkedin, icon: Linkedin },
    { label: "Instagram", url: m.instagram, icon: Instagram },
    { label: "Email", url: m.email ? `mailto:${m.email}` : "", icon: Mail },
  ].filter(s => s.url)
}

/**
 * Identity block: banner, logo, name (h1 on the public page), one-line description, category,
 * club-reported figures, social links and the primary action.
 */
export function MarketingProfile({ profile, action, compact = false, assetPreview = false, headingLevel }: { profile: ClubProfileDraft; action?: ReactNode; compact?: boolean; assetPreview?: boolean; headingLevel?: "h1" | "h2" }) {
  const m = publicMarketing(profile.marketing)
  const Heading = headingLevel ?? (compact ? "h2" : "h1")
  const links = socials(m)
  return <div className="oc-marketing-profile overflow-hidden rounded-2xl border oc-glass-surface">
    <div className={`oc-marketing-cover ${compact ? "h-32" : "h-44 sm:h-56"}`} style={{ background: `linear-gradient(120deg, ${profile.color}, var(--input))` }}>{profile.bannerUrl && <img src={clubAssetSource(profile.bannerUrl, assetPreview)} alt="" className="size-full object-cover" style={{ objectPosition: `${m.bannerPosition.x}% ${m.bannerPosition.y}%` }} />}</div>
    <div className={compact ? "px-5 pb-5" : "px-5 pb-6 sm:px-8"}>
      <ClubLogo logoUrl={profile.logoUrl} marketing={profile.marketing} assetPreview={assetPreview} text={profile.name.split(/\s+/).map(w => w[0]).slice(0, 3).join("")} color={profile.color} size="xl" alt={`${profile.name} logo`} className="-mt-10 mb-4 relative z-10 border-4 border-card !rounded-2xl" />
      <Heading className="oc-club-profile-title font-serif text-3xl font-semibold tracking-tight sm:text-4xl">{profile.name || "Your club name"}</Heading>
      {profile.tagline && <p className="mt-2 text-base leading-7 text-muted-foreground">{profile.tagline}</p>}
      {profile.category && <p className="oc-club-category mt-3"><span className="sr-only">Category: </span>{profile.category}</p>}
      <ProfileStatistics profile={profile} compact={compact} />
      {(links.length > 0 || action) && <div className="oc-club-hero-actions mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-4">
        {action && <div className="oc-club-primary-action min-w-0 flex-1">{action}</div>}
        {links.length > 0 && <ul className="flex gap-1" aria-label="Club links">{links.map(({ label, url, icon: Icon }) => <li key={label}><a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${profile.name} ${label}${label === "Email" ? "" : " (opens in a new tab)"}`} className="oc-tap-target inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-2"><Icon size={18} aria-hidden="true" /></a></li>)}</ul>}
      </div>}
    </div>
  </div>
}

type SectionProps = { profile: ClubProfileDraft; assetPreview?: boolean }
const sectionClass = "oc-club-section"

/** About: the description plus any club sections of kind "about" and outbound links. */
export function AboutSection({ profile, children, assetPreview = false }: SectionProps & { children?: ReactNode }) {
  const m = publicMarketing(profile.marketing)
  const sections = m.sections.filter(s => s.visible && s.kind === "about")
  const links = [...(m.videoUrl ? [{ label: "Watch our introduction", url: m.videoUrl, video: true }] : []), ...m.links.filter(l => l.url).map(l => ({ label: l.label || "Club website", url: l.url, video: false }))]
  if (!profile.description && !sections.length && !links.length && !children) return null
  return <section className={sectionClass} aria-labelledby="club-about">
    <h2 id="club-about">About</h2>
    {profile.description && <p className="oc-club-prose">{profile.description}</p>}
    {sections.map((s, i) => <ProfileSection key={i} section={s} assetPreview={assetPreview} parent="About" />)}
    {links.length > 0 && <ul className="oc-club-links" aria-label="More from the club">{links.map(l => <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.video ? <Play size={16} aria-hidden="true" /> : null}{l.label}<span className="sr-only"> (opens in a new tab)</span><ExternalLink size={14} aria-hidden="true" /></a></li>)}</ul>}
    {children}
  </section>
}

// A club section titled like the page section it sits in ("What members do") adds no heading of its own.
const sameHeading = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
function ProfileSection({ section, assetPreview, parent }: { section: ClubMarketing["sections"][number]; assetPreview: boolean; parent: string }) {
  const titled = !sameHeading(section.title, parent) && !(parent === "Recruitment and requirements" && sameHeading(section.title, "Recruitment"))
  // Card headings sit one level below whatever heading is actually rendered (no h2 → h4 jump).
  const CardHeading = titled ? "h4" : "h3"
  return <div className="oc-club-subsection">
    {titled && <h3>{section.title}</h3>}
    {section.body && <p className="oc-club-prose">{section.body}</p>}
    {section.cards.length > 0 && <div className="mt-4 grid gap-4 sm:grid-cols-2">{section.cards.map((c, j) => <article key={j} className="oc-club-card">{c.image && <img src={clubAssetSource(c.image, assetPreview)} alt={c.title || "Club highlight"} loading="lazy" className="mb-4 aspect-[4/3] w-full rounded-lg object-cover" />}<CardHeading>{c.title}</CardHeading>{c.description && <p>{c.description}</p>}{c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="oc-tap-link">Learn more about {c.title}<span className="sr-only"> (opens in a new tab)</span></a>}</article>)}</div>}
  </div>
}

/** What members do: programs, people and impact sections, projects, destinations, accolades, photos. */
export function MembersSection({ profile, assetPreview = false }: SectionProps) {
  const m = publicMarketing(profile.marketing)
  const sections = m.sections.filter(s => s.visible && ["programs", "people", "impact"].includes(s.kind))
  const accolades = m.accolades.filter(Boolean)
  const gallery = m.gallery.filter(g => g.url)
  if (!sections.length && !m.features.length && !m.placements.length && !accolades.length && !gallery.length) return null
  return <section className={sectionClass} aria-labelledby="club-members">
    <h2 id="club-members">What members do</h2>
    {sections.map((s, i) => <ProfileSection key={i} section={s} assetPreview={assetPreview} parent="What members do" />)}
    {m.features.length > 0 && <div className="oc-club-subsection"><h3>Projects and highlights</h3><ul className="oc-club-feature-list">{m.features.map((f, i) => <li key={i}><h4>{f.title}</h4>{f.description && <p>{f.description}</p>}{f.url && <a className="oc-tap-link" href={f.url} target="_blank" rel="noopener noreferrer">Learn more about {f.title}<span className="sr-only"> (opens in a new tab)</span><ExternalLink size={13} aria-hidden="true" /></a>}</li>)}</ul></div>}
    <MemberOutcomes profile={profile} />
    {accolades.length > 0 && <div className="oc-club-subsection"><h3>Recognition</h3><ul className="oc-club-check-list">{accolades.map((a, i) => <li key={i}><Check size={16} aria-hidden="true" />{a}</li>)}</ul></div>}
    {gallery.length > 0 && <div className="oc-club-subsection"><h3>A look inside</h3><div className="mt-4 grid grid-cols-2 gap-3">{gallery.map((g, i) => <figure key={i}><img src={clubAssetSource(g.url, assetPreview)} alt={g.caption || "Club activity"} className="aspect-[4/3] w-full rounded-lg object-cover" loading="lazy" />{g.caption && <figcaption className="mt-2 text-xs text-muted-foreground">{g.caption}</figcaption>}</figure>)}</div></div>}
  </section>
}

/** Recruitment-kind club sections, rendered inside the page's Recruitment and requirements section. */
export function RecruitmentNotes({ profile, assetPreview = false }: SectionProps) {
  const sections = publicMarketing(profile.marketing).sections.filter(s => s.visible && s.kind === "recruitment")
  return sections.length ? <>{sections.map((s, i) => <ProfileSection key={i} section={s} assetPreview={assetPreview} parent="Recruitment and requirements" />)}</> : null
}

/** Life in the club: benefits, who can join, time commitment and dues. Unknown values are omitted. */
export function LifeSection({ profile }: SectionProps) {
  const m = publicMarketing(profile.marketing)
  const benefits = m.benefits.filter(Boolean)
  const facts = ([["Who can join", m.eligibility], ["Time commitment", m.commitment], ["Membership dues", m.dues]] as const).filter(([, v]) => v)
  if (!benefits.length && !facts.length) return null
  return <section className={sectionClass} aria-labelledby="club-life">
    <h2 id="club-life">Life in the club</h2>
    {benefits.length > 0 && <ul className="oc-club-check-list">{benefits.map((b, i) => <li key={i}><Check size={16} aria-hidden="true" />{b}</li>)}</ul>}
    {facts.length > 0 && <dl className="oc-club-facts-list">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
  </section>
}

export function FaqSection({ profile }: SectionProps) {
  const faqs = publicMarketing(profile.marketing).faqs.filter(f => f.question && f.answer)
  if (!faqs.length) return null
  return <section className={sectionClass} aria-labelledby="club-faq">
    <h2 id="club-faq">Frequently asked questions</h2>
    <div className="oc-club-faq">{faqs.map((f, i) => <details key={i}><summary>{f.question}</summary><p>{f.answer}</p></details>)}</div>
  </section>
}

/** Editor and import previews: the same public sections, in the public page's order. */
export function MarketingSections({ profile, assetPreview = false }: SectionProps) {
  return <div className="oc-marketing-sections space-y-5">
    <MembersSection profile={profile} assetPreview={assetPreview} />
    {publicMarketing(profile.marketing).sections.some(s => s.visible && s.kind === "recruitment") && <section className={sectionClass} aria-labelledby="club-recruitment-preview"><h2 id="club-recruitment-preview">Recruitment and requirements</h2><RecruitmentNotes profile={profile} assetPreview={assetPreview} /></section>}
    <LifeSection profile={profile} />
    <FaqSection profile={profile} />
  </div>
}

/** Club-reported figures. Unknown values are not rendered; nothing links to research sources. */
export function ProfileStatistics({ profile, compact = false }: { profile: Parameters<typeof profileStatistics>[0]; compact?: boolean }) {
  const stats = profileStatistics(profile)
  return stats.length > 0 ? <dl className={`oc-profile-statistics ${compact ? "oc-profile-statistics-compact" : ""}`}>
    {stats.slice(0, compact ? 2 : undefined).map((stat, i) => <div key={i}>
      <dt>{stat.label}</dt><dd><strong>{stat.value}</strong><p>{stat.detail}</p></dd>
    </div>)}
  </dl> : null
}

/** Member destinations as a text list labelled club-reported. Employer logos are hidden (SHOW_EMPLOYER_MARKS). */
export function MemberOutcomes({ profile, compact = false }: { profile: { marketing?: unknown }; compact?: boolean }) {
  const m = readMarketing(profile.marketing)
  const names = [...new Set(m.placements.map(name => name.trim()).filter(Boolean))]
  if (!names.length) return null
  const Heading = compact ? "p" : "h3"
  return <div className={compact ? "oc-member-outcomes" : "oc-member-outcomes oc-club-subsection"}>
    <Heading className="oc-member-outcomes-title">Where members go <span>Club-reported</span></Heading>
    <ul>{names.slice(0, compact ? 6 : undefined).map(name => { const mark = SHOW_EMPLOYER_MARKS ? employerMark(name) : undefined; return <li key={name}>{mark && <Image src={mark} alt="" width={90} height={28} loading="lazy" className="oc-member-outcome-mark" />}{name}</li> })}</ul>
  </div>
}
