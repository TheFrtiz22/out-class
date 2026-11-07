import { LegalPage } from "@/components/landing/legal-page"
import { termsOfService } from "@/lib/legal-content"
import { pageTitle, publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata(pageTitle("Terms of Service"), termsOfService.summary, "/terms")

export default function TermsPage() {
  return <LegalPage {...termsOfService} />
}
