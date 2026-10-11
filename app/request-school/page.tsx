import { PublicInformationPage } from "@/components/landing/public-information-page"
import { SchoolRequestForm } from "@/components/landing/school-request-form"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata("Request Your School | OutClass", "Bring your university’s interest in OutClass to our team. Students, club leaders, and university administrators can request access without an account.", "/request-school")

export default function RequestSchoolPage() {
  return <PublicInformationPage className="oc-editorial-page oc-request-page" eyebrow="Request another campus" title="Request OutClass at your university." introduction="We’re beginning at UVA. Tell us which campus you’d like OutClass to support and how you’d use it."
    heroAside={<div className="oc-campus-letter" aria-label="Beginning at UVA, welcoming interest from other campuses"><div className="oc-campus-letter-top"><span>OUTCLASS / CAMPUS INTEREST</span><span>OPEN INVITATION</span></div><div className="oc-campus-letter-art" aria-hidden="true" /><p>Starting at UVA.<br /><em>Built to expand.</em></p><div className="oc-campus-letter-bottom"><span>University of Virginia</span><span>Your university</span></div></div>}>
    <section className="oc-public-section oc-request-layout" aria-label="School request">
      <div className="oc-request-introduction"><p className="oc-public-kicker">Start a conversation</p><h2>Tell us about your university.</h2><p>Tell us where you study or work and how OutClass could help. Students, club leaders, and university administrators are all welcome.</p><ol className="oc-request-expectations"><li><span>01</span><div><strong>Share your school</strong><p>Enter your university and contact details. No account required.</p></div></li><li><span>02</span><div><strong>We review the interest</strong><p>OutClass administrators review each request.</p></div></li><li><span>03</span><div><strong>We may follow up</strong><p>We may follow up at the email you provide.</p></div></li></ol><p className="oc-public-note">Submitting a request does not approve a university, create an account, or promise a launch date.</p></div>
      <SchoolRequestForm />
    </section>
  </PublicInformationPage>
}
