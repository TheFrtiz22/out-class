import type { ReactNode } from "react"
import Link from "next/link"
import { SectionReveal } from "@/components/motion/scroll-motion"
import { PublicInformationPage } from "@/components/landing/public-information-page"
import { Eye, LockKeyhole, Shield, ShieldCheck, UserCog, Users } from "@/components/icons"
import { CONTACT_EMAIL, CONTACT_HREF } from "@/lib/legal-content"
import { SECURITY_TXT_PATH } from "@/lib/security-txt"
import { publicPageMetadata, publicPageStructuredData } from "@/lib/seo"
import { cspNonce } from "@/utils/csp-nonce"

/**
 * A plain-language summary of how OutClass handles student data. Every sentence must stay true of
 * the current code; tests/security-page.test.cjs pins each claim to the module that makes it true.
 * Keep specifics general (no internal names, limits or file paths): this page is public.
 */
const description = "How OutClass protects student data: what we collect, who can see it, how access is checked, and how to report a security problem."
export const metadata = publicPageMetadata("Security and student data", description, "/security")
const structuredData = publicPageStructuredData("How OutClass protects student data", description, "/security")
const SECURITY_PAGE_UPDATED = "November 15, 2026"

const visibility = [
  { icon: Eye, title: "You and the clubs you apply to", body: "Your profile and applications are visible to you and to the clubs you apply to or join. A club sees only the profile fields it shows its reviewers, and nothing about your applications to other clubs." },
  { icon: Users, title: "The right roles within a club", body: "Inside a club, applicants, reviews and decisions are visible only to members whose role allows it. Applicants never see a club’s evaluations or notes." },
  { icon: ShieldCheck, title: "Clubs are kept apart", body: "One club cannot see another club’s applicants, notes or records." },
  { icon: LockKeyhole, title: "Private interests", body: "Your interest-survey answers are used only to suggest clubs to you. Clubs cannot see them." },
  { icon: UserCog, title: "Anonymous review", body: "When a club turns on anonymous review, reviewers do not see your name or photo." },
  { icon: Shield, title: "Limited staff access", body: "OutClass staff can open a club workspace only in a verified, read-only support view, and that access is logged." },
]

function Topic({ id, number, kicker, title, children }: { id: string; number: string; kicker: string; title: string; children: ReactNode }) {
  return (
    <SectionReveal id={id} className="oc-public-section oc-editorial-split oc-security-topic" aria-labelledby={`${id}-title`}>
      <div><p className="oc-public-kicker">{number} / {kicker}</p><h2 id={`${id}-title`} data-motion="text">{title}</h2></div>
      <div className="oc-editorial-prose" data-motion="body">{children}</div>
    </SectionReveal>
  )
}

export default async function SecurityPage() {
  const nonce = await cspNonce()
  return (
    <PublicInformationPage className="oc-editorial-page oc-security-page" eyebrow="Security" title="How OutClass protects student data." introduction="A plain-language summary of what we collect, who can see it, and the safeguards around it, as OutClass works today.">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <Topic id="who-runs-outclass" number="01" kicker="Who runs OutClass" title="An independent student platform.">
        <p>OutClass is operated by OutClassPlatforms LLC. It is independent: it is not an official University of Virginia service and is not owned, sponsored, or endorsed by the university.</p>
      </Topic>
      <Topic id="what-we-collect" number="02" kicker="What we collect" title="Only what recruiting needs.">
        <ul className="oc-security-list">
          <li><strong>Your profile.</strong> Your name, university email and the details you choose to add, such as your major, résumé or photo.</li>
          <li><strong>Your applications.</strong> The answers and files you send to a club, and your interview times.</li>
          <li><strong>Club records.</strong> Interview notes, evaluations and decisions that a club’s members write about applications sent to that club.</li>
          <li><strong>Technical data.</strong> Basic device, page and error information that keeps the service working and secure.</li>
        </ul>
        <p>We use it to run OutClass and keep it secure. We do not sell personal information or share it for advertising.</p>
      </Topic>
      <SectionReveal id="who-can-see-what" className="oc-public-section oc-security-topic" aria-labelledby="who-can-see-what-title">
        <p className="oc-public-kicker">03 / Who can see what</p>
        <h2 id="who-can-see-what-title" data-motion="text">Your information goes only where you send it.</h2>
        <ul className="oc-security-cards" data-motion="body">
          {visibility.map(({ icon: Icon, title, body }) => (
            <li key={title} className="oc-security-card"><Icon size={20} /><h3>{title}</h3><p>{body}</p></li>
          ))}
        </ul>
      </SectionReveal>
      <Topic id="how-its-enforced" number="04" kicker="How it’s enforced" title="Checked on our servers, every time.">
        <p>Every request is checked on our servers against your account and the club’s permissions before any data is returned or changed. Your browser never reads our database directly.</p>
        <p>Row-level security in the database adds a second layer of protection behind those checks.</p>
      </Topic>
      <Topic id="files" number="05" kicker="Files" title="Résumés and uploads stay private.">
        <p>Résumés, photos and other uploads are kept in private storage, not on public links. They open only after a permission check, through links that expire within minutes. Uploaded files are checked by their contents to confirm they match their file type.</p>
      </Topic>
      <Topic id="accounts" number="06" kicker="Accounts" title="Sign-in built to resist misuse.">
        <ul className="oc-security-list">
          <li>Students sign in with their UVA email address.</li>
          <li>One password standard applies everywhere a password is set, and it rejects short and common passwords.</li>
          <li>Repeated attempts at sign-in steps and account forms are rate limited.</li>
          <li>Sign-up and sign-in forms include bot protection.</li>
          <li>Optional two-step sign-in with an authenticator app.</li>
          <li>Signing out ends your session on that device.</li>
        </ul>
      </Topic>
      <Topic id="infrastructure" number="07" kicker="Infrastructure" title="Hosted in the United States.">
        <p>OutClass is hosted on Vercel and Supabase in the United States. Data travels over encrypted HTTPS connections.</p>
        <p>Our error monitoring removes personal details before a report is sent, and we do not record your sessions.</p>
      </Topic>
      <Topic id="your-controls" number="08" kicker="Your controls" title="You can delete your account.">
        <p>Request deletion in Settings, under Account &amp; Security. You can cancel within 14 days.</p>
        <ul className="oc-security-list">
          <li><strong>Deleted.</strong> Your profile, résumé, photo, files and in-progress applications.</li>
          <li><strong>Kept by the club.</strong> For decided applications, the club keeps its own review notes and decision, linked to an anonymized placeholder, and your answers are removed. Decision letters and interview copies of your résumé that a club already holds stay with that club.</li>
          <li><strong>Kept for records.</strong> Attendance, audit history and records of the terms you accepted keep only the anonymized placeholder.</li>
        </ul>
      </Topic>
      <Topic id="testing" number="09" kicker="Testing" title="Access rules are tested continuously.">
        <p>We test our access rules automatically on every proposed change. We also run attack-style tests against a disposable test copy of OutClass, never against real student data.</p>
      </Topic>
      <Topic id="report-a-problem" number="10" kicker="Report a problem" title="Found a security issue? Tell us.">
        <p>Email <a className="oc-security-link" href={CONTACT_HREF}>{CONTACT_EMAIL}</a> with what you found and how to reproduce it. Please do not access or change other people’s data while testing.</p>
        <p>Our <a className="oc-security-link" href={SECURITY_TXT_PATH}>security.txt</a> file lists the same contact.</p>
      </Topic>
      <footer className="oc-security-updated">
        <p>Last updated {SECURITY_PAGE_UPDATED}.</p>
        <Link prefetch={false} className="oc-public-text-link" href="/privacy">Read the Privacy Policy</Link>
      </footer>
    </PublicInformationPage>
  )
}
