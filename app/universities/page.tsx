import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PublicInformationPage } from "@/components/landing/public-information-page"
import { PromoVideoFigure } from "@/components/landing/promo-video"
import { privateRobots, publicPageMetadata } from "@/lib/seo"

const description = "What OutClass gives students, student leaders and a campus: one place to find, apply to and hear back from student organizations, alongside the engagement platform a university already uses."
// Unlisted for now (docs/public-site/videos.md): reachable by link from Request your school, kept out of
// search results, the sitemap, the header and the footer until university outreach starts.
export const metadata = { ...publicPageMetadata("For universities", description, "/universities"), robots: privateRobots }

const points = [
  { label: "For students", title: "One place to find, apply and hear back.", body: "A directory of participating clubs, one profile reused for every application, a status for each one, and a decision every time, whether it is a yes or a no." },
  { label: "For student leaders", title: "A consistent process they can review.", body: "Applications, anonymous review when a round turns it on, interview scheduling, shared scoring, live voting and decision letters in one workspace, with roles that control who sees what." },
  { label: "For your campus", title: "Records that outlast each exec board.", body: "Club rosters with roles, and meetings with agendas and QR check-in attendance. OutClass works alongside your engagement platform. It does not replace it." },
] as const

export default function UniversitiesPage() {
  return (
    <PublicInformationPage className="oc-editorial-page oc-about-page oc-universities-page" eyebrow="For universities" title="A better recruiting season for every student." introduction="Selective student organizations run applications, interviews and decisions across forms, spreadsheets and group chats. OutClass puts that process in one place, for the students applying and the students running it."
      heroActions={<div className="oc-public-actions"><Button asChild size="lg"><Link prefetch={false} href="/request-school">Start a conversation</Link></Button><a className="oc-public-text-link" href="#campus-video">Watch the video</a></div>}>
      <section id="campus-video" className="oc-public-section oc-universities-video" aria-labelledby="campus-video-title">
        <h2 id="campus-video-title" className="sr-only">OutClass for a campus, in a video</h2>
        <PromoVideoFigure video="universities" priority sizes="(max-width: 1200px) 100vw, 1120px" />
      </section>
      <section className="oc-public-section oc-universities-points" aria-labelledby="campus-points-title">
        <p className="oc-public-kicker">What each group gets</p>
        <h2 id="campus-points-title">One process, three points of view.</h2>
        <ul>
          {points.map(point => <li key={point.label} className="oc-about-perspective oc-public-glass"><span className="oc-about-margin-label">{point.label}</span><h3>{point.title}</h3><p>{point.body}</p></li>)}
        </ul>
      </section>
      <aside className="oc-about-independence"><p>OutClass is operated by OutClassPlatforms LLC, a Virginia limited liability company. It began at the University of Virginia and is independent: it is not an official University of Virginia service and is not owned, sponsored, or endorsed by the university. The applicants, members and decisions in the video are sample data from a demo club.</p></aside>
      <section className="oc-public-section oc-about-next oc-public-glass" aria-labelledby="campus-next-title">
        <div><p className="oc-public-kicker">Next step</p><h2 id="campus-next-title">Tell us about your campus.</h2></div>
        <div><p>Share your university and how student organizations recruit there. OutClass administrators review each request.</p><div className="oc-public-actions"><Button asChild size="lg" className="oc-public-cta"><Link href="/request-school" prefetch={false}>Start a conversation</Link></Button></div><p className="oc-public-note">A request expresses interest. It does not approve a university or promise a launch date.</p></div>
      </section>
    </PublicInformationPage>
  )
}
