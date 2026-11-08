import { notFound } from "next/navigation"
import { LegalPage } from "@/components/landing/legal-page"
import { LEGAL_PAGES_PUBLIC, privacyPolicy } from "@/lib/legal-content"
import { pageTitle, privateRobots, publicPageMetadata } from "@/lib/seo"

// Not public until the owner turns on LEGAL_PAGES_PUBLIC (lib/legal-content.ts): until then a 404.
export const metadata = LEGAL_PAGES_PUBLIC ? publicPageMetadata(pageTitle("Privacy Policy"), privacyPolicy.summary, "/privacy") : { title: "Privacy Policy", robots: privateRobots }

export default function PrivacyPage() {
  if (!LEGAL_PAGES_PUBLIC) notFound()
  return <LegalPage {...privacyPolicy} />
}
