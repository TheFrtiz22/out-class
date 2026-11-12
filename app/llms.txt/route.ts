import { SITE_URL, SITE_DESCRIPTION, ORGANIZATION_DESCRIPTION, LEGAL_ORGANIZATION_NAME } from "@/lib/seo"
import { getIndexableClubs } from "@/lib/public-club-seo"
import { LEGAL_PAGES_PUBLIC } from "@/lib/legal-content"

// A plain-text guide for language models (https://llmstxt.org). Public pages only: the same
// set as the sitemap, so nothing here is private or unlisted.
export const revalidate = 600

export async function GET() {
  const clubs = await getIndexableClubs()
  const lines = [
    "# OutClass",
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    ORGANIZATION_DESCRIPTION,
    `OutClass is operated by ${LEGAL_ORGANIZATION_NAME}. The first campus is the University of Virginia.`,
    "",
    "## Public pages",
    "",
    `- [Home](${SITE_URL}/): what OutClass does for students and club leaders`,
    `- [Club recruitment at UVA](${SITE_URL}/uva): how UVA students find, apply to and interview with clubs`,
    `- [About](${SITE_URL}/about): who OutClass is for and why it exists`,
    `- [Request your school](${SITE_URL}/request-school): how another university can join`,
    ...(LEGAL_PAGES_PUBLIC ? [`- [Privacy Policy](${SITE_URL}/privacy)`, `- [Terms of Service](${SITE_URL}/terms)`] : []),
    "",
    ...(clubs.length ? ["## Club profiles", "", ...clubs.map(club => `- [${club.name.replace(/[[\]]/g, " ").replace(/\s+/g, " ").trim()}](${SITE_URL}/club/${encodeURIComponent(club.id)})`), ""] : []),
    "## Optional",
    "",
    `- [Sitemap](${SITE_URL}/sitemap.xml)`,
    "",
    "Applications, interviews, member records and other signed-in pages are private and not described here.",
    "",
  ]
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}
