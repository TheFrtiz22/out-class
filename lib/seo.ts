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

// These parameters select account, authentication, or demonstration interfaces.
// Tracking parameters still consolidate to the indexable homepage canonical.
export const privateHomepageParams = ["workspace", "view", "demoClub", "next", "error", "signup"] as const
