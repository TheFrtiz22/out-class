import type { Metadata } from "next"

export const LEGAL_ORGANIZATION_NAME = "OutClassPlatforms LLC"
export const SITE_URL = "https://www.out-class.net"
/** Every page title is "<Page> · OutClass"; the root layout's template adds the suffix exactly once. */
export const TITLE_SUFFIX = " · OutClass"
export function pageTitle(name: string) {
  const bare = name.replace(/(?:\s*[·|]\s*OutClass)+$/i, "").trim()
  return bare ? `${bare}${TITLE_SUFFIX}` : "OutClass"
}
export const SITE_TITLE = "OutClass · UVA club applications and recruitment"
export const SITE_DESCRIPTION = "Find and apply to participating UVA clubs with one OutClass profile. Manage applications, interviews, and recruitment decisions in one place."
export const ORGANIZATION_DESCRIPTION = "OutClass is a platform for college club recruitment, helping students discover and apply to organizations while giving club leaders tools to manage applicants, interviews, scheduling, evaluations, and decisions."
/** Shared defaults for every page (inherited unless a page sets its own openGraph/twitter). */
export const socialDefaults = (): Metadata => ({
  openGraph: { siteName: "OutClass", type: "website", locale: "en_US", ...(socialImage ? { images: [socialImage] } : {}) },
  twitter: { card: "summary_large_image", ...(socialImage ? { images: [socialImage.url] } : {}) },
})
export const privateRobots: Metadata["robots"] = { index: false, follow: false }
export const publicRobots: Metadata["robots"] = { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } }

// The glass 1200 × 630 card prerendered at /og/outclass.png (lib/share-card.tsx), unless a
// deployment overrides its public path.
const imagePath = process.env.OUTCLASS_OG_IMAGE_PATH || "/og/outclass.png"
export const socialImage = imagePath?.startsWith("/") && !imagePath.startsWith("//")
  ? { url: `${SITE_URL}${imagePath}`, width: 1200, height: 630, alt: "OutClass: apply to UVA clubs with one profile" }
  : undefined

export function publicPageMetadata(name: string, description: string, path: string): Metadata {
  const url = new URL(path, SITE_URL).toString()
  const title = name === SITE_TITLE ? name : pageTitle(name)
  return {
    title: { absolute: title },
    description,
    publisher: LEGAL_ORGANIZATION_NAME,
    alternates: { canonical: url },
    robots: publicRobots,
    openGraph: { title, description, url, siteName: "OutClass", type: "website", locale: "en_US", ...(socialImage ? { images: [socialImage] } : {}) },
    twitter: { card: "summary_large_image", title, description, ...(socialImage ? { images: [socialImage.url] } : {}) },
  }
}

export const websiteStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "OutClass", legalName: LEGAL_ORGANIZATION_NAME, url: `${SITE_URL}/`, description: ORGANIZATION_DESCRIPTION, logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-icon.png`, width: 180, height: 180 } },
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: "OutClass", alternateName: ["OutClass UVA", "Out Class"], url: `${SITE_URL}/`, description: SITE_DESCRIPTION, inLanguage: "en", publisher: { "@id": `${SITE_URL}/#organization` } },
  ],
}

export function publicPageStructuredData(name: string, description: string, path: string, type: "WebPage" | "AboutPage" = "WebPage") {
  const url = new URL(path, SITE_URL).toString()
  return {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${url}#webpage`,
    name,
    description,
    url,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en",
  }
}

/**
 * JSON for a <script type="application/ld+json">. JSON.stringify already escapes quotes; this also
 * escapes the characters that could close the script element or confuse the HTML parser, so club
 * text is data, never markup.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)
}

export type ClubStructuredDataInput = { id: string; name: string; description: string; logoUrl?: string | null; sameAs?: (string | null | undefined)[] }

/**
 * The trail above a club's own page. Signed out (what crawlers see) it follows the public pages and
 * matches the BreadcrumbList JSON-LD; signed in it starts at Explore.
 */
export function clubBreadcrumbs(clubName: string, { signedIn = false }: { signedIn?: boolean } = {}) {
  return signedIn
    ? [{ label: "Explore", href: "/explore" }, { label: clubName }]
    : [{ label: "OutClass", href: "/" }, { label: "UVA", href: "/uva" }, { label: clubName }]
}

/** Organization data for an indexable public club page, from fields the page already shows. */
export function clubStructuredData(club: ClubStructuredDataInput) {
  const url = new URL(`/club/${encodeURIComponent(club.id)}`, SITE_URL).toString()
  // Only absolute web URLs or bundled /logos files; uploaded assets and data: URIs are left out.
  const logo = club.logoUrl && (/^https:\/\//i.test(club.logoUrl) ? club.logoUrl : /^\/logos\/[\w.-]+$/.test(club.logoUrl) ? `${SITE_URL}${club.logoUrl}` : undefined)
  const sameAs = [...new Set((club.sameAs ?? []).filter((link): link is string => !!link && /^https?:\/\//i.test(link)))]
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${url}#organization`,
        name: club.name,
        description: club.description.trim().replace(/\s+/g, " "),
        url,
        ...(logo ? { logo } : {}),
        ...(sameAs.length ? { sameAs } : {}),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: clubBreadcrumbs(club.name).map((crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.label,
          item: crumb.href ? new URL(crumb.href, SITE_URL).toString() : url,
        })),
      },
    ],
  }
}

// These parameters select account, authentication, or demonstration interfaces.
// Tracking parameters still consolidate to the indexable homepage canonical.
export const privateHomepageParams = ["workspace", "view", "demoClub", "next", "error", "signup"] as const
