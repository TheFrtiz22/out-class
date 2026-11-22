import { LegalPage } from "@/components/landing/legal-page"
import { LegalPlaceholderPage } from "@/components/landing/legal-placeholder-page"
import { LEGAL_PAGES_PUBLIC, legalPlaceholders, termsOfService } from "@/lib/legal-content"
import { pageTitle, privateRobots, publicPageMetadata } from "@/lib/seo"

// Until the owner turns on LEGAL_PAGES_PUBLIC (lib/legal-content.ts) this is a marked placeholder, not indexed.
export const metadata = LEGAL_PAGES_PUBLIC ? publicPageMetadata(pageTitle("Terms of Service"), termsOfService.summary, "/terms") : { title: "Terms of Service", robots: privateRobots }

export default function TermsPage() {
  if (!LEGAL_PAGES_PUBLIC) return <LegalPlaceholderPage {...legalPlaceholders.terms} />
  return <LegalPage {...termsOfService} />
}
