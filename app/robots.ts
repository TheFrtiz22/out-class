import type { MetadataRoute } from "next"
import { SITE_URL, privateHomepageParams } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        // Sign-in, signup and password pages are crawlable on purpose: they send noindex (page metadata and
        // X-Robots-Tag in next.config.mjs), which Google only reads on pages it may fetch. Every page links them.
        "/api/", "/auth/",
        "/platform", "/settings/", "/club-access/", "/club-claims/", "/invitations/",
        "/club/*/workspace", "/club/*/tasks", "/meetings", "/check-in",
        "/interviews", "/decisions", "/vote", "/live-voting", "/voting/",
        "/preview", "/design-system",
        ...privateHomepageParams.map(key => `/*?*${key}=`),
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
