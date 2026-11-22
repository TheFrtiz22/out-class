import { PublicPageFrame } from "./public-page-frame"
import { CONTACT_EMAIL, CONTACT_HREF, type LegalPlaceholder } from "@/lib/legal-content"
import "./legal-page.css"

/** /terms and /privacy while the real documents are unpublished: a clearly marked placeholder, no legal text. */
export function LegalPlaceholderPage({ title, summary }: LegalPlaceholder) {
  return <PublicPageFrame width="reading">
    <article className="oc-legal oc-public-glass" aria-labelledby="legal-title">
      <header>
        <p className="oc-legal-eyebrow">Legal · Placeholder</p>
        <h1 id="legal-title">{title}</h1>
        <p className="oc-legal-summary">{summary}</p>
      </header>
      <section aria-labelledby="legal-contact">
        <h2 id="legal-contact">Contact</h2>
        <p>{"Questions, or a request to see or delete your information, can be sent to"} <a href={CONTACT_HREF}>{CONTACT_EMAIL}</a>.</p>
      </section>
    </article>
  </PublicPageFrame>
}
