import { notFound } from "next/navigation"
import { LegalPage } from "@/components/landing/legal-page"
import { LEGAL_PAGES_PUBLIC, cookiePolicy } from "@/lib/legal-content"
import { pageTitle, privateRobots, publicPageMetadata } from "@/lib/seo"

// Not public until the owner turns on LEGAL_PAGES_PUBLIC (lib/legal-content.ts): until then a 404.
export const metadata = LEGAL_PAGES_PUBLIC ? publicPageMetadata(pageTitle("Cookie Policy"), cookiePolicy.summary, "/cookies") : { title: "Cookie Policy", robots: privateRobots }

export default function CookiesPage() {
  if (!LEGAL_PAGES_PUBLIC) notFound()
  return <LegalPage {...cookiePolicy} />
}
