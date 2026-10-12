import { ArrowRight } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { PublicInformationPage } from "@/components/landing/public-information-page"
import { publicPageMetadata, publicPageStructuredData, SITE_URL } from "@/lib/seo"
import { publicFaqs } from "@/lib/public-faq"
import { PublicFaq } from "@/components/landing/public-faq"

const title = "OutClass at UVA | Club Recruitment at the University of Virginia"
const description = "Learn how OutClass helps University of Virginia students discover organizations, apply to clubs, manage interviews, and track recruitment, with tools for club leaders to manage applicants and decisions."
export const metadata = publicPageMetadata(title, description, "/uva")

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    publicPageStructuredData("OutClass at the University of Virginia", description, "/uva"),
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/uva#faq`,
      isPartOf: { "@id": `${SITE_URL}/uva#webpage` },
      mainEntity: publicFaqs.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
    },
  ],
}

export default function UvaPage() {
  return (
    <PublicInformationPage
      className="oc-editorial-page oc-campus-page"
      eyebrow="Beginning at UVA"
      title="OutClass for UVA club recruitment."
      introduction="Search for participating clubs, apply with your student profile, schedule interviews, and check application decisions in one place. Club leaders have a separate workspace for running recruitment."
      heroAside={
        <figure className="oc-campus-hero-photo">
          <Image
            src="/images/campus/lawn-aerial.jpg"
            alt="An aerial view of the University of Virginia Lawn, with the Rotunda and surrounding pavilions in warm evening light."
            width={675}
            height={450}
            sizes="(max-width: 800px) calc(100vw - 40px), (max-width: 1200px) 44vw, 500px"
            priority
          />
        </figure>
      }
      heroActions={<div className="oc-public-actions"><a className="oc-public-text-link" href="#faq">Read the FAQs <ArrowRight size={16} aria-hidden="true" /></a><Link prefetch={false} className="oc-public-text-link" href="/#about">See how it works</Link></div>}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <section className="oc-campus-context oc-public-section"><p className="oc-public-kicker">Starting at the University of Virginia</p><div className="oc-editorial-split"><h2>One profile.<br />Every opportunity.</h2><div className="oc-editorial-prose"><p>Students can discover organizations, submit applications, manage interviews, and follow their recruitment status. Leaders have tools to configure applications, coordinate interviews, evaluate applicants, and manage decisions.</p><p>OutClass is independent: it is not an official University of Virginia service and is not owned, sponsored, or endorsed by the university.</p><a className="oc-public-text-link" href="/about">The story behind OutClass <ArrowRight size={16} aria-hidden="true" /></a></div></div></section>
      <section id="faq" className="oc-public-section oc-information-faq" aria-labelledby="faq-title">
        <div className="oc-faq-heading"><p className="oc-public-kicker">Frequently asked questions</p><h2 id="faq-title">Questions about using OutClass</h2><p>Accounts, applications, interview scheduling, and who can use OutClass.</p></div>
        <PublicFaq />
        <div className="oc-faq-next"><div><h3>Not at UVA?</h3><p>Your campus could be next. Tell us where you’d like to see OutClass.</p></div><a className="oc-public-text-link" href="/request-school">Request Your School <ArrowRight size={16} aria-hidden="true" /></a></div>
      </section>
    </PublicInformationPage>
  )
}
