import { ArrowRight } from "lucide-react"
import { PublicInformationPage } from "@/components/landing/public-information-page"
import { publicPageMetadata, publicPageStructuredData, SITE_URL } from "@/lib/seo"

const title = "OutClass at UVA | Club Recruitment at the University of Virginia"
const description = "Learn how OutClass helps University of Virginia students discover organizations, apply to clubs, manage interviews, and track recruitment, with tools for club leaders to manage applicants and decisions."
export const metadata = publicPageMetadata(title, description, "/uva")

const faqs = [
  { question: "What is OutClass?", answer: "OutClass is a platform for college club recruitment. It brings organization discovery, applications, interviews, and recruitment status into one experience for students, with recruiting tools for club leaders." },
  { question: "What can students use OutClass for?", answer: "Students can discover organizations, maintain one profile, submit applications, manage interviews, and track their recruitment status." },
  { question: "What can club leaders use OutClass for?", answer: "Club leaders can configure applications, manage applicants, coordinate interviews and scheduling, collaborate on evaluations, and manage recruitment decisions." },
  { question: "Is OutClass part of the University of Virginia?", answer: "OutClass is an independent platform being built for students and student organizations beginning at the University of Virginia. It is not an official University of Virginia service and is not owned, sponsored, or endorsed by the university." },
  { question: "When will OutClass be available?", answer: "OutClass is beginning with a campus pilot at the University of Virginia. Clubs join the pilot individually; no general launch date has been announced on this page." },
] as const

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    publicPageStructuredData("OutClass at the University of Virginia", description, "/uva"),
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/uva#faq`,
      isPartOf: { "@id": `${SITE_URL}/uva#webpage` },
      mainEntity: faqs.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
    },
  ],
}

export default function UvaPage() {
  return (
    <PublicInformationPage eyebrow="Beginning at UVA" title="OutClass at the University of Virginia" introduction="OutClass is a student-focused club recruitment platform beginning at the University of Virginia. Students can discover organizations, submit applications, manage interviews, and follow their recruitment status through one profile, while club leaders can manage applicants and recruiting workflows in one place.">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <section className="oc-information-section">
        <h2>One profile. Every opportunity.</h2>
        <p>Club recruitment can mean separate forms, schedules, and updates for every organization. OutClass brings those steps together so students can keep their opportunities organized and club leaders can work through a clearer recruiting process.</p>
      </section>
      <div className="oc-information-cards">
        <section className="oc-information-card">
          <p className="oc-story-eyebrow">Your next chapter</p>
          <h2>For UVA students</h2>
          <ul>
            <li>Discover student organizations and explore opportunities.</li>
            <li>Maintain one profile and submit club applications.</li>
            <li>Manage interviews and keep your next steps organized.</li>
            <li>Track recruitment status in one place.</li>
          </ul>
        </section>
        <section className="oc-information-card">
          <p className="oc-story-eyebrow">Your next class</p>
          <h2>For student organizations</h2>
          <ul>
            <li>Configure applications and manage applicants.</li>
            <li>Coordinate interviews and scheduling.</li>
            <li>Collaborate on applicant evaluations.</li>
            <li>Manage decisions and streamline recruiting workflows.</li>
          </ul>
        </section>
      </div>
      <section className="oc-information-section">
        <h2>Built around student organizations</h2>
        <p>OutClass is being built around the workflow of selective and application-based student organizations, beginning at UVA. It is an independent platform, not an official university service. The focus is on the students applying and the student leaders organizing recruitment.</p>
        <a className="oc-information-link" href="/about">Learn about OutClass <ArrowRight size={16} aria-hidden="true" /></a>
      </section>
      <section className="oc-information-section oc-information-faq" aria-labelledby="faq-title">
        <h2 id="faq-title">Frequently asked questions</h2>
        {faqs.map(({ question, answer }) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
      </section>
    </PublicInformationPage>
  )
}
