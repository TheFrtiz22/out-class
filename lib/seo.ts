import type { Metadata } from "next"

export const SITE_URL = "https://www.out-class.net"
export const SITE_TITLE = "OutClass — One profile. Every opportunity."
export const SITE_DESCRIPTION = "OutClass helps college students discover clubs, apply, manage interviews, and track recruitment, with tools for club leaders to manage applicants and decisions."
export const ORGANIZATION_DESCRIPTION = "OutClass is a platform for college club recruitment, helping students discover and apply to organizations while giving club leaders tools to manage applicants, interviews, scheduling, evaluations, and decisions."
export const privateRobots: Metadata["robots"] = { index: false, follow: false }
export const publicRobots: Metadata["robots"] = { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } }

// Use the bundled 1200 × 630 social card unless a deployment overrides its public path.
const imagePath = process.env.OUTCLASS_OG_IMAGE_PATH || "/images/outclass-social.jpg"
const socialImage = imagePath?.startsWith("/") && !imagePath.startsWith("//")
  ? { url: `${SITE_URL}${imagePath}`, width: 1200, height: 630, alt: "OutClass — Student club applications and recruitment" }
  : undefined

export function publicPageMetadata(title: string, description: string, path: string): Metadata {
  const url = new URL(path, SITE_URL).toString()
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: publicRobots,
    openGraph: { title, description, url, siteName: "OutClass", type: "website", locale: "en_US", ...(socialImage ? { images: [socialImage] } : {}) },
    twitter: { card: "summary_large_image", title, description, ...(socialImage ? { images: [socialImage.url] } : {}) },
  }
}

export const websiteStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "OutClass", url: `${SITE_URL}/`, description: ORGANIZATION_DESCRIPTION, logo: { "@type": "ImageObject", url: `${SITE_URL}/outclass-brand-mark.png`, width: 1254, height: 1254 } },
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
