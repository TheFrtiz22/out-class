import type { ReactNode } from "react"
import { SectionReveal } from "@/components/motion/scroll-motion"
import { PublicInformationPage } from "@/components/landing/public-information-page"
import { CONTACT_EMAIL, CONTACT_HREF } from "@/lib/legal-content"
import { publicPageMetadata } from "@/lib/seo"

/**
 * The public support page: the Support URL for the App Store and Google Play listings
 * (docs/mobile/store/listing.md). Anyone can open it, signed in or not. It only points to pages
 * that already exist (/forgot-password, /delete-account, /security) and to the contact address.
 */
const description = "Get help with OutClass: signing in, resetting your password, deleting your account and contacting us."
export const metadata = publicPageMetadata("Support", description, "/support")

function Topic({ id, number, kicker, title, children }: { id: string; number: string; kicker: string; title: string; children: ReactNode }) {
  return (
    <SectionReveal id={id} className="oc-public-section oc-editorial-split" aria-labelledby={`${id}-title`}>
      <div><p className="oc-public-kicker">{number} / {kicker}</p><h2 id={`${id}-title`} data-motion="text">{title}</h2></div>
      <div className="oc-editorial-prose" data-motion="body">{children}</div>
    </SectionReveal>
  )
}

export default function SupportPage() {
  return (
    <PublicInformationPage className="oc-editorial-page" eyebrow="Support" title="How can we help?" introduction="Answers to the most common questions about the OutClass app and website, and how to reach us.">
      <Topic id="contact" number="01" kicker="Contact" title="Write to us.">
        <p>Email <a className="oc-public-text-link" href={CONTACT_HREF}>{CONTACT_EMAIL}</a> with your question and the email address you sign in with. Please don’t send your password.</p>
      </Topic>
      <Topic id="signing-in" number="02" kicker="Signing in" title="Use your university email.">
        <p>OutClass accounts use your university email address. If you forgot your password, <a className="oc-public-text-link" href="/forgot-password">request a reset link</a> and we’ll email it to that address.</p>
      </Topic>
      <Topic id="delete-account" number="03" kicker="Your account" title="Deleting your account.">
        <p>You can request deletion in the app or on the web, and cancel within 14 days. <a className="oc-public-text-link" href="/delete-account">See the steps and what is removed</a>.</p>
      </Topic>
      <Topic id="security" number="04" kicker="Security" title="Report a security problem.">
        <p>Read <a className="oc-public-text-link" href="/security">how OutClass protects student data</a>, and email us if you find a problem.</p>
      </Topic>
    </PublicInformationPage>
  )
}
