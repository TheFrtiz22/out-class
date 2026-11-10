import type { Metadata } from "next"
import { pageTitle, SITE_URL } from "@/lib/seo"

/** Text for club link previews; pure so it can be shared by metadata, the card and tests. */
const UNCLAIMED = "Club leadership has not yet claimed this profile."

/** Same monogram as the club page logo fallback: first letters of up to three words. */
export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map(word => word[0]).slice(0, 3).join("").toUpperCase() || "OC"
}

/** The club's one-line pitch, else the opening of its description. Never placeholder copy. */
export function shareSummary(tagline: string | null | undefined, description: string | null | undefined) {
  const clean = (value: string | null | undefined) => (value || "").replace(UNCLAIMED, "").trim().replace(/\s+/g, " ")
  const pitch = clean(tagline)
  if (pitch) return pitch
  const about = clean(description)
  const sentence = /^.{40,200}?[.!?](?=\s|$)/.exec(about)?.[0]
  return sentence || about.slice(0, 200)
}

/** Description for og:description / twitter:description, with a fallback that still sells the link. */
export function shareDescription(name: string, summary: string) {
  return (summary || `See ${name} on OutClass and apply with one profile.`).slice(0, 200)
}

/**
 * Open Graph / X card text for a club link. Images come from the route's opengraph-image and
 * twitter-image files, so every public club link unfurls as a profile card, indexed or not.
 */
export function clubShareMetadata(club: { id: string; name: string; summary: string }): Metadata {
  const title = pageTitle(club.name)
  const description = shareDescription(club.name, club.summary)
  const url = new URL(`/club/${encodeURIComponent(club.id)}`, SITE_URL).toString()
  return {
    openGraph: { title, description, url, siteName: "OutClass", type: "website", locale: "en_US" },
    twitter: { card: "summary_large_image", title, description },
  }
}
