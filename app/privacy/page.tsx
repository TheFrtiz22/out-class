import { LegalPage } from "@/components/landing/legal-page"
import { LegalPlaceholderPage } from "@/components/landing/legal-placeholder-page"
import { LEGAL_PAGES_PUBLIC, legalPlaceholders, privacyPolicy } from "@/lib/legal-content"
import { pageTitle, privateRobots, publicPageMetadata } from "@/lib/seo"

// Until the owner turns on LEGAL_PAGES_PUBLIC (lib/legal-content.ts) this is a marked placeholder, not indexed.
export const metadata = LEGAL_PAGES_PUBLIC ? publicPageMetadata(pageTitle("Privacy Policy"), privacyPolicy.summary, "/privacy") : { title: "Privacy Policy", robots: privateRobots }

export default function PrivacyPage() {
  if (!LEGAL_PAGES_PUBLIC) return <LegalPlaceholderPage {...legalPlaceholders.privacy} />
  return <LegalPage {...privacyPolicy} />
}
