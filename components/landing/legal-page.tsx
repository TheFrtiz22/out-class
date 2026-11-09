import { PublicPageFrame } from "./public-page-frame"
import { CONTACT_EMAIL, CONTACT_HREF, LEGAL_EFFECTIVE_DATE, type LegalSection } from "@/lib/legal-content"
import "./legal-page.css"

/** Privacy and Terms: one readable column inside the shared public frame. */
export function LegalPage({ title, summary, sections }: { title: string; summary: string; sections: LegalSection[] }) {
  return <PublicPageFrame width="reading">
    <article className="oc-legal oc-public-glass" aria-labelledby="legal-title">
      <header>
        <p className="oc-legal-eyebrow">Legal</p>
        <h1 id="legal-title">{title}</h1>
        <p className="oc-legal-summary">{summary}</p>
        <p className="oc-legal-updated">Effective {LEGAL_EFFECTIVE_DATE}</p>
      </header>
      {sections.map(section => <section key={section.heading} aria-labelledby={`legal-${section.heading.replace(/\W+/g, "-").toLowerCase()}`}>
        <h2 id={`legal-${section.heading.replace(/\W+/g, "-").toLowerCase()}`}>{section.heading}</h2>
        {section.paragraphs?.map(text => <p key={text}>{text}</p>)}
        {section.list && <ul>{section.list.map(item => <li key={item}>{item}</li>)}</ul>}
      </section>)}
      <section aria-labelledby="legal-contact">
        <h2 id="legal-contact">Contact</h2>
        <p>{"Questions about this document can be sent to"} <a href={CONTACT_HREF}>{CONTACT_EMAIL}</a>.</p>
      </section>
    </article>
  </PublicPageFrame>
}
