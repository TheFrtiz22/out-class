import { ArrowRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SectionReveal } from "@/components/motion/scroll-motion"
import { PublicInformationPage } from "@/components/landing/public-information-page"
import { publicPageMetadata, publicPageStructuredData } from "@/lib/seo"

const description = "OutClass is building infrastructure for college club recruitment, beginning at the University of Virginia. Learn who it is for and why it exists."
export const metadata = publicPageMetadata("OutClass | About", description, "/about")
const structuredData = publicPageStructuredData("About OutClass", description, "/about", "AboutPage")

export default function AboutPage() {
  return (
    <PublicInformationPage className="oc-editorial-page oc-about-page" eyebrow="About OutClass" title="Club recruitment, without the scattered forms and spreadsheets." introduction="OutClass is being built by UVA students to make it easier to discover organizations, apply, schedule interviews, and keep track of what happens next."
      heroActions={<div className="oc-public-actions"><a className="oc-public-text-link" href="#why-outclass">Why we're building it <ArrowRight size={16} aria-hidden="true" /></a></div>}
      heroAside={<figure className="oc-about-hero-photo"><Image src="/images/campus/autumn-lawn-1600.webp" alt="Autumn trees framing the University of Virginia Lawn" width={1600} height={1614} sizes="(max-width: 800px) 100vw, 45vw" priority /><figcaption><span>Beginning on Grounds</span><span>Charlottesville, Virginia</span></figcaption></figure>}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <SectionReveal id="why-outclass" className="oc-public-section oc-editorial-split oc-about-problem" aria-labelledby="why-title">
        <div><p className="oc-public-kicker">01 / Why this exists</p><h2 id="why-title" data-motion="text">Club recruitment is scattered.</h2></div>
        <div className="oc-editorial-prose" data-motion="body"><p>Students juggle separate forms, email threads, deadlines, and interview links. Club leaders juggle spreadsheets, scheduling, reviewer notes, and decisions.</p><p>That work is already complicated enough. We’re building one place to handle it, without asking clubs to give up control of their recruiting process.</p></div>
      </SectionReveal>
      <div className="oc-public-navy oc-about-idea">
        <SectionReveal className="oc-public-section" aria-labelledby="idea-title">
          <p className="oc-public-kicker">02 / The product</p><h2 id="idea-title" data-motion="text">One process.<br />Two different workspaces.</h2>
          <div className="oc-about-perspectives">
            <div data-motion="body"><span className="oc-about-margin-label">For students</span><h3>Find clubs. Apply. See what’s next.</h3><p>Discover organizations. Apply through one profile. Manage interviews and follow your recruitment status.</p></div>
            <div data-motion="body"><span className="oc-about-margin-label">For club leaders</span><h3>Run recruitment with your team.</h3><p>Configure applications, coordinate interviews, collaborate on evaluations, and manage recruiting decisions.</p></div>
          </div>
          <Link prefetch={false} className="oc-public-text-link" href="/#about">See the product in action <ArrowRight size={16} aria-hidden="true" /></Link>
        </SectionReveal>
      </div>
      <SectionReveal className="oc-public-section oc-editorial-split oc-about-grounded" aria-labelledby="grounds-title">
        <figure data-motion="visual"><Image src="/images/campus/sunset-rotunda-1600.webp" alt="The UVA Rotunda and Lawn at sunset" width={1600} height={1067} sizes="(max-width: 800px) 100vw, 50vw" /><figcaption>The University of Virginia Lawn</figcaption></figure>
        <div><p className="oc-public-kicker">03 / The team behind it</p><h2 id="grounds-title" data-motion="text">Built by students at UVA.</h2><div className="oc-editorial-prose" data-motion="body"><p>OutClass started as a student-built project at the University of Virginia. We’re beginning with selective and application-based organizations because their recruitment involves real coordination on both sides.</p><p>We’re rolling out with participating clubs one at a time. That means testing the actual workflow, listening to the students and leaders using it, and fixing what doesn’t work before taking it to other campuses.</p></div><a className="oc-public-text-link" href="/uva">Explore OutClass at UVA <ArrowRight size={16} aria-hidden="true" /></a></div>
      </SectionReveal>
      <aside className="oc-about-independence"><p>OutClass is independent: it is not an official University of Virginia service and is not owned, sponsored, or endorsed by the university.</p></aside>
      <SectionReveal className="oc-public-section oc-about-next" aria-labelledby="next-campus-title">
        <div><p className="oc-public-kicker">04 / Beyond UVA</p><h2 id="next-campus-title" data-motion="text">Bring OutClass to your campus.</h2></div>
        <div data-motion="body"><p>If your campus has the same scattered recruitment process, tell us which university and organizations could use OutClass.</p><div className="oc-public-actions"><Button asChild><Link href="/request-school" prefetch={false}>Request Your School <ArrowRight size={16} aria-hidden="true" /></Link></Button><Link className="oc-public-text-link" prefetch={false} href="/#about">Explore how it works</Link></div><p className="oc-public-note">Requests express interest. They do not approve a university or enable account access.</p></div>
      </SectionReveal>
    </PublicInformationPage>
  )
}
