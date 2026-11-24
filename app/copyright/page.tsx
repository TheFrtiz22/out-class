import type { ReactNode } from "react"
import { SectionReveal } from "@/components/motion/scroll-motion"
import { PublicInformationPage } from "@/components/landing/public-information-page"
import { CONTACT_EMAIL, CONTACT_HREF, DMCA_AGENT, DMCA_AGENT_EMAIL_HREF, DMCA_AGENT_PHONE_HREF } from "@/lib/legal-content"
import { publicPageMetadata } from "@/lib/seo"

/**
 * The public copyright page: OutClass's DMCA designated agent and how to send a takedown notice or a
 * counter-notice. 17 U.S.C. § 512(c)(2) requires the agent's name, address, phone number and email to be
 * available on the site in a place the public can reach, so this page is public, indexable and needs no
 * sign-in. The agent's details come from DMCA_AGENT (lib/legal-content.ts) and must match the filing with
 * the U.S. Copyright Office. tests/copyright-page.test.cjs pins the statutory elements below.
 */
const description = "How to send OutClass a copyright (DMCA) takedown notice or counter-notice, and the contact details of our designated agent."
export const metadata = publicPageMetadata("Copyright and DMCA notices", description, "/copyright")

/** What a takedown notice must include (17 U.S.C. § 512(c)(3)(A)). */
const NOTICE_ELEMENTS = [
  "A physical or electronic signature of the copyright owner or of a person authorized to act on the owner’s behalf.",
  "Identification of the copyrighted work you say is infringed, or, if several works are covered by one notice, a representative list of them.",
  "Identification of the material you say is infringing and information reasonably sufficient for us to find it on OutClass, such as a link to the club page, event or post.",
  "Your name, mailing address, telephone number and email address, so we can contact you.",
  "A statement that you have a good-faith belief that the use of the material is not authorized by the copyright owner, its agent or the law.",
  "A statement that the information in the notice is accurate and, under penalty of perjury, that you are the copyright owner or are authorized to act on the owner’s behalf.",
] as const

/** What a counter-notice must include (17 U.S.C. § 512(g)(3)). */
const COUNTER_NOTICE_ELEMENTS = [
  "Your physical or electronic signature.",
  "Identification of the material that was removed or disabled and where it appeared before it was removed.",
  "A statement, under penalty of perjury, that you have a good-faith belief that the material was removed or disabled as a result of mistake or misidentification.",
  "Your name, address and telephone number, and a statement that you consent to the jurisdiction of the federal district court for the judicial district where your address is (or, if your address is outside the United States, any judicial district in which OutClass may be found), and that you will accept service of process from the person who sent the original notice or that person’s agent.",
] as const

function Topic({ id, number, kicker, title, children }: { id: string; number: string; kicker: string; title: string; children: ReactNode }) {
  return (
    <SectionReveal id={id} className="oc-public-section oc-editorial-split" aria-labelledby={`${id}-title`}>
      <div><p className="oc-public-kicker">{number} / {kicker}</p><h2 id={`${id}-title`} data-motion="text">{title}</h2></div>
      <div className="oc-editorial-prose" data-motion="body">{children}</div>
    </SectionReveal>
  )
}

export default function CopyrightPage() {
  return (
    <PublicInformationPage className="oc-editorial-page" eyebrow="Copyright" title="Copyright and DMCA notices." introduction="OutClass respects the rights of copyright owners. If you believe something posted on OutClass infringes your copyright, send a notice to our designated agent and we will review it under the Digital Millennium Copyright Act (17 U.S.C. § 512).">
      <Topic id="designated-agent" number="01" kicker="Designated agent" title="Where to send notices.">
        <p>Send copyright notices and counter-notices to our designated agent:</p>
        <address className="oc-copyright-agent" style={{ fontStyle: "normal" }}>
          <strong>{DMCA_AGENT.name}</strong><br />
          {DMCA_AGENT.serviceProvider}<br />
          {DMCA_AGENT.addressLines.map(line => <span key={line}>{line}<br /></span>)}
          Phone: {DMCA_AGENT_PHONE_HREF ? <a className="oc-public-text-link" href={DMCA_AGENT_PHONE_HREF}>{DMCA_AGENT.phone}</a> : DMCA_AGENT.phone}<br />
          Email: <a className="oc-public-text-link" href={DMCA_AGENT_EMAIL_HREF}>{DMCA_AGENT.email}</a>
        </address>
        <p>Email is the fastest way to reach us. This address is only for copyright notices. For anything else, including other reports about content, write to <a className="oc-public-text-link" href={CONTACT_HREF}>{CONTACT_EMAIL}</a>.</p>
      </Topic>
      <Topic id="notice" number="02" kicker="Takedown notice" title="What to include in a notice.">
        <p>To be effective, your notice must be in writing and include:</p>
        <ol className="oc-security-list" style={{ listStyle: "decimal" }}>
          {NOTICE_ELEMENTS.map(line => <li key={line}>{line}</li>)}
        </ol>
        <p>When we receive a notice that meets these requirements, we remove or disable access to the material promptly and tell the person who posted it.</p>
      </Topic>
      <Topic id="counter-notice" number="03" kicker="Counter-notice" title="If your content was removed by mistake.">
        <p>If you believe material you posted was removed or disabled by mistake or misidentification, you may send our designated agent a written counter-notice that includes:</p>
        <ol className="oc-security-list" style={{ listStyle: "decimal" }}>
          {COUNTER_NOTICE_ELEMENTS.map(line => <li key={line}>{line}</li>)}
        </ol>
        <p>We will send a copy of a valid counter-notice to the person who sent the original notice. Unless that person tells us they have filed a court action seeking to restrain the activity, we may restore the material 10 to 14 business days after we receive the counter-notice.</p>
      </Topic>
      <Topic id="repeat-infringers" number="04" kicker="Repeat infringers" title="Accounts that keep infringing.">
        <p>OutClass will, in appropriate circumstances, disable or terminate the accounts of users who are repeat infringers.</p>
      </Topic>
      <Topic id="false-claims" number="05" kicker="Before you send" title="False claims have consequences.">
        <p>Under 17 U.S.C. § 512(f), anyone who knowingly misrepresents that material is infringing, or that it was removed by mistake, may be liable for damages, including costs and attorneys’ fees. If you are not sure whether material infringes your copyright, consider asking a lawyer first.</p>
      </Topic>
    </PublicInformationPage>
  )
}
