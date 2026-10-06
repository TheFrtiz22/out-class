import { ArrowRight } from "lucide-react"
import { PublicInformationPage } from "@/components/landing/public-information-page"
import { publicPageMetadata, publicPageStructuredData } from "@/lib/seo"

const description = "OutClass is building infrastructure for college club recruitment, beginning at the University of Virginia. Learn who it is for and why it exists."
export const metadata = publicPageMetadata("OutClass | About", description, "/about")
const structuredData = publicPageStructuredData("About OutClass", description, "/about", "AboutPage")

export default function AboutPage() {
  return (
    <PublicInformationPage eyebrow="About OutClass" title="One place for the next opportunity." introduction="OutClass is a platform for college club recruitment. Beginning at the University of Virginia, it brings discovery, applications, interviews, evaluations, and recruiting decisions into one experience.">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <section className="oc-information-section">
        <h2>Why OutClass exists</h2>
        <p>Applying to student organizations often means navigating separate forms, schedules, and updates. OutClass is building infrastructure to bring those steps together, helping students follow their opportunities and club leaders coordinate recruitment.</p>
      </section>
      <section className="oc-information-section">
        <h2>For students and club leaders</h2>
        <p>Students can discover organizations, apply through one profile, manage interviews, and track their recruitment status. Club leaders have tools for application configuration, applicant management, scheduling, evaluations, and decisions.</p>
      </section>
      <section className="oc-information-section">
        <h2>Beginning at the University of Virginia</h2>
        <p>OutClass is being built for selective and application-based student organizations beginning at UVA. OutClass is independent: it is not an official University of Virginia service and is not owned, sponsored, or endorsed by the university.</p>
        <a className="oc-information-link" href="/uva">Explore OutClass at UVA <ArrowRight size={16} aria-hidden="true" /></a>
      </section>
    </PublicInformationPage>
  )
}
