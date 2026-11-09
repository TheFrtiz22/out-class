import Image from "next/image"
import "./journey-tabs.css"

/** Decorative stand-ins for the tools recruitment usually spreads across; hidden from assistive technology. */
const tools = ["Interest form (responses)", "Applicants_v3_FINAL.xlsx", "Re: Re: Fwd: interview times??", "Booking link", "Rubric (copy of copy)", "Group chat, 214 unread", "Paper sign-in sheet"] as const

export function ScatteredTools() {
  return (
    <section className="oc-scattered" aria-labelledby="scattered-title">
      <div className="oc-scattered-inner">
        <div className="oc-scattered-tools" aria-hidden="true">
          {tools.map((tool, index) => <span key={tool} className="oc-scattered-tool oc-public-glass" data-tool={index + 1}>{tool}</span>)}
        </div>
        <div className="oc-scattered-copy">
          <p className="oc-journey-kicker">Sound familiar?</p>
          <h2 id="scattered-title">Recruitment season, minus the open tabs.</h2>
          <p>Students retype the same answers into a dozen forms. Leaders chase spreadsheets, booking links and reply-all threads. OutClass puts every application, interview and decision in one place your whole team can see.</p>
          <p className="oc-scattered-summary oc-public-glass">
            <Image src="/brand/04-wordmark-two-color.svg" alt="OutClass" width={80} height={18} unoptimized />
            <span>One profile · one pipeline · one source of truth</span>
          </p>
        </div>
      </div>
    </section>
  )
}
