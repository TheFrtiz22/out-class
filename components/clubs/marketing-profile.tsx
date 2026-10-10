"use client"

import { clubAssetSource } from "@/lib/club-assets"
import type { ReactNode } from "react"
import { Globe, Instagram, Linkedin, Mail, ExternalLink, Trophy, Users, Check, Play } from "lucide-react"
import { readMarketing, type ClubProfileDraft } from "@/lib/club-marketing"

export function MarketingProfile({ profile, action, compact = false, assetPreview = false }: { profile: ClubProfileDraft; action?: ReactNode; compact?: boolean; assetPreview?: boolean }) {
  const m = readMarketing(profile.marketing)
  const Heading = compact ? "h2" : "h1"
  const stats = [
    ...(m.showAcceptance && profile.acceptanceRate != null ? [{ label: "Acceptance", value: `${profile.acceptanceRate}%` }] : []),
    ...(m.showAum && profile.aumValue != null ? [{ label: "AUM", value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0, notation: "compact" }).format(profile.aumValue) }] : []),
    ...(m.showMembers && m.memberCount != null ? [{ label: "Members", value: String(m.memberCount) }] : []), ...m.metrics.filter(s => s.label && s.value),
  ]
  const socials = [{ label: "Website", url: m.website, icon: Globe }, { label: "LinkedIn", url: m.linkedin, icon: Linkedin }, { label: "Instagram", url: m.instagram, icon: Instagram }, { label: "Email", url: m.email ? `mailto:${m.email}` : "", icon: Mail }].filter(s => s.url)
  return <div className="oc-marketing-profile overflow-hidden rounded-2xl border bg-card shadow-sm">
    <div className={`oc-marketing-cover ${compact ? "h-32" : "h-44 sm:h-56"}`} style={{ background: `linear-gradient(120deg, ${profile.color}, #8b93a5)` }}>{profile.bannerUrl && <img src={clubAssetSource(profile.bannerUrl, assetPreview)} alt="" className="size-full object-cover" />}</div>
    <div className={compact ? "px-5 pb-5" : "px-6 pb-6 sm:px-8"}>
      <div className="-mt-10 mb-4 flex size-20 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-card shadow-sm">{profile.logoUrl ? <img src={clubAssetSource(profile.logoUrl, assetPreview)} alt={`${profile.name} logo`} className="size-full object-contain p-1" /> : <span className="flex size-full items-center justify-center text-xl font-semibold" style={{ color: "var(--foreground)" }}>{profile.name.split(/\s+/).map(w => w[0]).slice(0, 3).join("")}</span>}</div>
      <Heading className="oc-club-profile-title text-xl font-semibold tracking-tight sm:text-2xl">{profile.name || "Your club name"}</Heading>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{profile.tagline || ""}</p>
      <span className="mt-3 inline-block rounded-md bg-muted px-2.5 py-1 text-xs">{profile.category}</span>
      {stats.length > 0 && <><dl className="mt-5 grid grid-cols-3 gap-3 rounded-xl border bg-muted/30 p-4">{stats.map((s, i) => <div key={i} className="min-w-0 text-center"><dd className="break-words text-base font-semibold">{s.value}</dd><dt className="mt-1 break-words text-[length:var(--oc-size-10)] uppercase tracking-wide text-muted-foreground">{s.label}</dt></div>)}</dl><p className="mt-2 text-[length:var(--oc-size-10)] text-muted-foreground">Club-reported figures</p></>}
      {m.placements.length > 0 && <section className="mt-5"><h3 className="oc-card-heading mb-2 flex items-center gap-2 uppercase tracking-wide text-muted-foreground"><Users size={14} />Member outcomes</h3><div className="flex flex-wrap gap-2">{m.placements.filter(Boolean).map((p, i) => <span key={i} className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{p}</span>)}</div></section>}
      {m.accolades.length > 0 && <section className="mt-5"><h3 className="oc-card-heading mb-2 flex items-center gap-2 uppercase tracking-wide text-muted-foreground"><Trophy size={14} />Accolades</h3><ul className="space-y-1 text-sm">{m.accolades.filter(Boolean).map((a, i) => <li key={i}>{a}</li>)}</ul></section>}
      {(socials.length > 0 || action) && <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-4"><div className="flex gap-1">{socials.map(({ label, url, icon: Icon }) => <a key={label} href={url} target="_blank" rel="noopener noreferrer" aria-label={label} className="rounded-md p-2 text-muted-foreground hover:bg-muted focus-visible:outline-2"><Icon size={18} /></a>)}</div>{action}</div>}
    </div>
  </div>
}

export function MarketingSections({ profile, assetPreview = false }: { profile: ClubProfileDraft; assetPreview?: boolean }) {
  const m = readMarketing(profile.marketing)
  const section = "rounded-xl border bg-card p-5 sm:p-6"
  return <div className="oc-marketing-sections space-y-5">
    {m.sections.filter(s=>s.visible).map((s,i)=><section key={i} className={section}><p className="text-xs uppercase tracking-widest text-muted-foreground">{s.kind}</p><h2 className="oc-section-heading mt-2">{s.title}</h2>{s.body && <p className="mt-4 whitespace-pre-line break-words text-sm leading-7 text-muted-foreground">{s.body}</p>}{s.cards.length>0 && <div className="mt-6 grid gap-4 sm:grid-cols-2">{s.cards.map((c,j)=><article key={j} className="min-w-0 rounded-xl border bg-muted/20 p-5">{c.image && <img src={clubAssetSource(c.image,assetPreview)} alt={c.title || "Club highlight"} loading="lazy" className="mb-4 aspect-[4/3] w-full rounded-lg object-cover"/>}<h3 className="font-semibold break-words">{c.title}</h3><p className="mt-2 whitespace-pre-line break-words text-sm leading-7 text-muted-foreground">{c.description}</p>{c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-sm underline">Learn more<span className="sr-only"> about {c.title}</span></a>}</article>)}</div>}</section>)}
    {(m.benefits.length > 0 || m.eligibility || m.commitment || m.dues) && <section className={section}><h2 className="oc-section-heading !text-lg !font-semibold">Life in the club</h2><ul className="mt-4 space-y-3">{m.benefits.filter(Boolean).map((b, i) => <li key={i} className="flex gap-2 text-sm leading-6"><Check className="mt-1 size-4 shrink-0" />{b}</li>)}</ul><dl className="mt-4 space-y-3 text-sm">{[["Who can join", m.eligibility], ["Time commitment", m.commitment], ["Membership dues", m.dues]].filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="font-semibold">{k}</dt><dd className="mt-1 whitespace-pre-line text-muted-foreground">{v}</dd></div>)}</dl></section>}
    {m.features.length > 0 && <section className={section}><h2 className="oc-section-heading !text-lg !font-semibold">Projects & highlights</h2><div className="mt-4 space-y-5">{m.features.map((f, i) => <div key={i}><h3 className="oc-card-heading ">{f.title}</h3><p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">{f.description}</p>{f.url && <a className="mt-2 inline-flex items-center gap-2 text-sm underline" href={f.url} target="_blank" rel="noopener noreferrer">Learn more <ExternalLink size={13} /></a>}</div>)}</div></section>}
    {m.gallery.length > 0 && <section className={section}><h2 className="oc-section-heading !text-lg !font-semibold">A look inside</h2><div className="mt-4 grid grid-cols-2 gap-3">{m.gallery.filter(g => g.url).map((g, i) => <figure key={i}><img src={clubAssetSource(g.url,assetPreview)} alt={g.caption || "Club activity"} className="aspect-[4/3] w-full rounded-lg object-cover" loading="lazy" />{g.caption && <figcaption className="mt-2 text-xs text-muted-foreground">{g.caption}</figcaption>}</figure>)}</div></section>}
    {(m.videoUrl || m.links.length > 0) && <section className={section}><h2 className="oc-section-heading !text-lg !font-semibold">Explore more</h2><div className="mt-3 flex flex-col items-start gap-3">{m.videoUrl && <a href={m.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm underline"><Play size={16} />Watch our introduction</a>}{m.links.filter(l => l.url).map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm underline">{l.label || "Visit link"}<ExternalLink size={14} /></a>)}</div></section>}
    {m.faqs.length > 0 && <section className={section}><h2 className="oc-section-heading !text-lg !font-semibold">Frequently asked questions</h2><div className="mt-3 divide-y">{m.faqs.map((f, i) => <details key={i} className="py-3"><summary className="cursor-pointer text-sm font-medium">{f.question}</summary><p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">{f.answer}</p></details>)}</div></section>}
  </div>
}
