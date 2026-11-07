import { LegalPage } from "@/components/landing/legal-page"
import { privacyPolicy } from "@/lib/legal-content"
import { pageTitle, publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata(pageTitle("Privacy Policy"), privacyPolicy.summary, "/privacy")

export default function PrivacyPage() {
  return <LegalPage {...privacyPolicy} />
}
