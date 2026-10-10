import type { MetadataRoute } from "next"
import { SITE_URL, privateHomepageParams } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/", "/auth/", "/login", "/signup", "/forgot-password", "/reset-password",
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
