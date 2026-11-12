import { notFound } from "next/navigation"
import { LegalPage } from "@/components/landing/legal-page"
import { LEGAL_PAGES_PUBLIC, legalDetails } from "@/lib/legal-content"
import { pageTitle, privateRobots, publicPageMetadata } from "@/lib/seo"

// Not public until the owner turns on LEGAL_PAGES_PUBLIC (lib/legal-content.ts): until then a 404.
// The mailing address is read on the server from OUTCLASS_POSTAL_ADDRESS; unset shows a placeholder.
export const metadata = LEGAL_PAGES_PUBLIC ? publicPageMetadata(pageTitle("Legal"), "Business details for OutClass and links to our policies.", "/legal") : { title: "Legal", robots: privateRobots }

export default function LegalDetailsPage() {
  if (!LEGAL_PAGES_PUBLIC) notFound()
  return <LegalPage {...legalDetails(process.env.OUTCLASS_POSTAL_ADDRESS)} />
}
