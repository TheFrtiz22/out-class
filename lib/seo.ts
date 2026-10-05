import type { Metadata } from "next"

export const SITE_URL = "https://www.out-class.net"
export const SITE_TITLE = "OutClass | Student Club Applications & Recruitment"
export const SITE_DESCRIPTION = "Discover student organizations, create one profile, apply to college clubs, and track recruitment. OutClass brings clarity to students and club leaders."
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
    { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "OutClass", url: SITE_URL },
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: "OutClass", url: SITE_URL, description: SITE_DESCRIPTION, inLanguage: "en", publisher: { "@id": `${SITE_URL}/#organization` } },
  ],
}

// These parameters select account, authentication, or demonstration interfaces.
// Tracking parameters still consolidate to the indexable homepage canonical.
export const privateHomepageParams = ["workspace", "view", "demoClub", "next", "error"] as const
