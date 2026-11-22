import type { ReactNode } from "react"
import Link from "next/link"
import { SectionReveal } from "@/components/motion/scroll-motion"
import { PublicInformationPage } from "@/components/landing/public-information-page"
import { CONTACT_EMAIL, CONTACT_HREF } from "@/lib/legal-content"
import { publicPageMetadata } from "@/lib/seo"

/**
 * The public account-deletion page Google Play asks for: anyone can open it, signed in or not.
 * Every fact here is the product's own: the steps and labels of the app (mobile/src/app/settings/account.tsx)
 * and the web (components/settings/account-deletion.tsx), the 14-day window, and what is kept.
 * tests/delete-account-page.test.cjs pins each one to that code, so a change there fails until this copy is checked.
 */
const description = "How to delete your OutClass account in the app or on the web, how long it takes, and what is removed or kept."
export const metadata = publicPageMetadata("Delete your account", description, "/delete-account")

/** The same bullets the app and the web show beside the Delete account button. */
const DELETION_EFFECTS = [
  "Your profile, résumé, headshot, files and in-progress applications are deleted.",
  "For decided applications, the club keeps its own review notes and the decision, linked to an anonymized placeholder. Your answers are removed.",
  "Decision letters and interview copies of your résumé that a club already holds stay with that club’s records.",
  "Attendance and audit history keep only the anonymized placeholder.",
] as const

function Topic({ id, number, kicker, title, children }: { id: string; number: string; kicker: string; title: string; children: ReactNode }) {
  return (
    <SectionReveal id={id} className="oc-public-section oc-editorial-split" aria-labelledby={`${id}-title`}>
      <div><p className="oc-public-kicker">{number} / {kicker}</p><h2 id={`${id}-title`} data-motion="text">{title}</h2></div>
      <div className="oc-editorial-prose" data-motion="body">{children}</div>
    </SectionReveal>
  )
}

export default function DeleteAccountPage() {
  return (
    <PublicInformationPage className="oc-editorial-page" eyebrow="Account deletion" title="Delete your OutClass account." introduction="You can delete your OutClass account yourself, in the OutClass app or on the web. Your account is scheduled for deletion 14 days after you ask, and you can cancel any time before then.">
      <Topic id="in-the-app" number="01" kicker="In the app" title="From Settings.">
        <ol className="oc-security-list" style={{ listStyle: "decimal" }}>
          <li>Open the OutClass app and sign in.</li>
          <li>Go to <strong>Settings</strong>, then <strong>Account &amp; Security</strong>.</li>
          <li>Under <strong>Delete account</strong>, type your university email or the word DELETE. If your account has a password, enter it too.</li>
          <li>Tap <strong>Delete account</strong> and confirm.</li>
        </ol>
      </Topic>
      <Topic id="on-the-web" number="02" kicker="On the web" title="From your account settings.">
        <ol className="oc-security-list" style={{ listStyle: "decimal" }}>
          <li><Link prefetch={false} className="oc-public-text-link" href="/login">Sign in to OutClass</Link>.</li>
          <li>Go to <strong>Settings</strong>, then <strong>Account &amp; Security</strong>.</li>
          <li>Under <strong>Delete account</strong>, type your university email or the word DELETE. If your account has a password, enter it too.</li>
          <li>Select <strong>Delete account</strong> and confirm.</li>
        </ol>
      </Topic>
      <Topic id="what-happens" number="03" kicker="What happens next" title="14 days to change your mind.">
        <p>Your account is scheduled for deletion 14 days after your request, and we email a confirmation to your university email. Until that date you can cancel from the same page in the app or on the web, and your account stays as it is.</p>
        <p>When your account is deleted:</p>
        <ul className="oc-security-list">
          {DELETION_EFFECTS.map(line => <li key={line}>{line}</li>)}
        </ul>
      </Topic>
      <Topic id="need-help" number="04" kicker="Need help?" title="Can’t sign in?">
        <p>If you can’t sign in or use the app, email <a className="oc-public-text-link" href={CONTACT_HREF}>{CONTACT_EMAIL}</a> from your university email and ask us to delete your account.</p>
      </Topic>
    </PublicInformationPage>
  )
}
