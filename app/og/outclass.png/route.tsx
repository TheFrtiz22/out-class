import { renderSiteShareCard } from "@/lib/share-card"

// The site-wide link-preview card (lib/seo.ts socialImage). Rendered once at build and served as
// a static PNG; pages with their own card (club profiles) override it.
export const dynamic = "force-static"

export function GET() {
  return renderSiteShareCard()
}
