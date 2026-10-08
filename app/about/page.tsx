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
    <PublicInformationPage className="oc-editorial-page oc-about-page" eyebrow="About OutClass" title="Opportunity deserves a clearer path." introduction="Campus is full of people doing something worth joining. Finding them—and finding your way in—should feel like an opportunity, not another process to untangle."
      heroActions={<div className="oc-public-actions"><a className="oc-public-text-link" href="#why-outclass">The idea behind OutClass <ArrowRight size={16} aria-hidden="true" /></a></div>}
      heroAside={<figure className="oc-about-hero-photo"><Image src="/images/campus/autumn-lawn-1600.webp" alt="Autumn trees framing the University of Virginia Lawn" width={1600} height={1614} sizes="(max-width: 800px) 100vw, 45vw" priority /><figcaption><span>Beginning on Grounds</span><span>Charlottesville, Virginia</span></figcaption></figure>}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <SectionReveal id="why-outclass" className="oc-public-section oc-editorial-split oc-about-problem" aria-labelledby="why-title">
        <div><p className="oc-public-kicker">01 / The problem</p><h2 id="why-title" data-motion="text">Good opportunities.<br />Too many loose ends.</h2></div>
        <div className="oc-editorial-prose" data-motion="body"><p>Applying to student organizations often means navigating separate forms, schedules, and updates. Students are trying to find their people. Club leaders are trying to build their next team.</p><p>OutClass exists to bring those steps together—so there is less process to piece together, and more room to focus on the people involved.</p></div>
      </SectionReveal>
      <div className="oc-public-navy oc-about-idea">
        <SectionReveal className="oc-public-section" aria-labelledby="idea-title">
          <p className="oc-public-kicker">02 / The idea</p><h2 id="idea-title" data-motion="text">One experience.<br />Both sides of the opportunity.</h2>
          <div className="oc-about-perspectives">
            <div data-motion="body"><span className="oc-about-margin-label">For students</span><h3>A place to find your next chapter.</h3><p>Discover organizations. Apply through one profile. Manage interviews and follow your recruitment status.</p></div>
            <div data-motion="body"><span className="oc-about-margin-label">For club leaders</span><h3>A place to build your next class.</h3><p>Configure applications, coordinate interviews, collaborate on evaluations, and manage recruiting decisions.</p></div>
          </div>
          <Link prefetch={false} className="oc-public-text-link" href="/#about">See the product in action <ArrowRight size={16} aria-hidden="true" /></Link>
        </SectionReveal>
      </div>
      <SectionReveal className="oc-public-section oc-editorial-split oc-about-grounded" aria-labelledby="grounds-title">
        <figure data-motion="visual"><Image src="/images/campus/sunset-rotunda-1600.webp" alt="The UVA Rotunda and Lawn at sunset" width={1600} height={1067} sizes="(max-width: 800px) 100vw, 50vw" /><figcaption>One campus to begin. A broader possibility ahead.</figcaption></figure>
        <div><p className="oc-public-kicker">03 / Beginning at UVA</p><h2 id="grounds-title" data-motion="text">Built around a real campus.</h2><div className="oc-editorial-prose" data-motion="body"><p>OutClass is beginning at the University of Virginia, with a campus pilot for selective and application-based student organizations. Clubs join individually.</p><p>Starting with one campus keeps the focus on a concrete workflow: the students applying and the leaders organizing recruitment. The broader vision is to make campus opportunities easier to discover and navigate at more universities.</p></div><a className="oc-public-text-link" href="/uva">Explore OutClass at UVA <ArrowRight size={16} aria-hidden="true" /></a></div>
      </SectionReveal>
      <aside className="oc-about-independence"><p>OutClass is independent: it is not an official University of Virginia service and is not owned, sponsored, or endorsed by the university.</p></aside>
      <SectionReveal className="oc-public-section oc-about-next" aria-labelledby="next-campus-title">
        <div><p className="oc-public-kicker">04 / The next chapter</p><h2 id="next-campus-title" data-motion="text">More campuses.<br />More ways to belong.</h2></div>
        <div data-motion="body"><p>OutClass is starting at UVA. If you see a place for it at your university, we’d like to hear from you.</p><div className="oc-public-actions"><Button asChild><Link href="/request-school" prefetch={false}>Request Your School <ArrowRight size={16} aria-hidden="true" /></Link></Button><Link className="oc-public-text-link" prefetch={false} href="/#about">Explore how it works</Link></div><p className="oc-public-note">Requests express interest. They do not approve a university or enable account access.</p></div>
      </SectionReveal>
    </PublicInformationPage>
  )
}
