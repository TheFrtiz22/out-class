import { PublicInformationPage } from "@/components/landing/public-information-page"
import { SchoolRequestForm } from "@/components/landing/school-request-form"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata("Request Your School | OutClass", "Bring your university’s interest in OutClass to our team. Students, club leaders, and university administrators can request access without an account.", "/request-school")

export default function RequestSchoolPage() {
  return <PublicInformationPage eyebrow="Your campus, next" title="Bring OutClass to your school." introduction="Beginning at UVA, built with more campuses in mind. Tell us about your university and how you’d like to use OutClass. Students, club leaders, and university administrators are welcome—no account required.">
    <section className="oc-information-section" aria-label="School request"><SchoolRequestForm /></section>
  </PublicInformationPage>
}
