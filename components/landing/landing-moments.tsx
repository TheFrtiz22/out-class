import Image from "next/image"
import type { LandingPerspective } from "./journey-content"
import { StatusMark } from "@/components/ui/status-pill"
import { decisionMoment, featureGrid, recruitmentSeason, type FeatureSpecimen } from "./landing-sections-content"
import "./landing-moments.css"

const percent = (part: number, whole: number) => `${Math.round((part / whole) * 100)}%`

/** Static pictures of the product. role="img" makes each one a single labelled image: its "buttons" are
 *  plain text in pill shapes, never focusable or announced as controls. */
function VoteIllustration() {
  const v = decisionMoment.leader.illustration
  const voted = v.tally.pass + v.tally.hold + v.tally.notPass
  return (
    <div className="oc-moment-screen" role="img" aria-label={`Sample live vote: ${v.applicant.name}, ${voted} of ${v.members} members voted, ${v.tally.pass} pass, ${v.tally.hold} hold, ${v.tally.notPass} not pass, against a target of ${v.target} passes.`}>
      <div className="oc-moment-row oc-moment-quiet"><span className="oc-moment-strong">{v.round}</span><span>{v.status}</span></div>
      <div className="oc-moment-person">
        <Image src={v.applicant.photo} alt="" width={64} height={64} loading="lazy" />
        <div><p className="oc-moment-name">{v.applicant.name}</p><p className="oc-moment-quiet">{v.applicant.detail}</p></div>
      </div>
      <div className="oc-moment-tally">
        <div className="oc-moment-row"><span className="oc-moment-strong">{voted} of {v.members} members voted</span><span className="oc-moment-quiet">Target: {v.target} passes</span></div>
        <div className="oc-moment-bar">
          <span data-vote="pass" style={{ width: percent(v.tally.pass, v.members) }} />
          <span data-vote="hold" style={{ width: percent(v.tally.hold, v.members) }} />
          <span data-vote="not-pass" style={{ width: percent(v.tally.notPass, v.members) }} />
        </div>
        <div className="oc-moment-legend oc-moment-quiet"><span>Pass {v.tally.pass}</span><span>Hold {v.tally.hold}</span><span>Not pass {v.tally.notPass}</span></div>
      </div>
      <div className="oc-moment-actions">{v.actions.map((action, i) => <span key={action} className="oc-moment-action" data-primary={i === 0 || undefined}>{action}</span>)}</div>
    </div>
  )
}

function OfferIllustration() {
  const o = decisionMoment.student.illustration
  return (
    <div className="oc-moment-screen oc-moment-offer" role="img" aria-label={`Sample offer from ${o.club.name}: “${o.message}” ${o.deadline}.`}>
      <div className="oc-moment-person">
        <Image src={o.club.logo} alt="" width={52} height={52} loading="lazy" />
        <div><p className="oc-moment-strong">{o.club.name}</p><p className="oc-moment-quiet">{o.club.detail}</p></div>
      </div>
      <p className="oc-moment-message">{o.message}</p>
      <p className="oc-moment-quiet">{o.deadline}</p>
      <div className="oc-moment-actions">{o.actions.map((action, i) => <span key={action} className="oc-moment-action" data-primary={i === 0 || undefined}>{action}</span>)}</div>
    </div>
  )
}

/** A static fragment of product UI (sample data) paired with each feature. role="img" with a full text
 *  description stands in for a screenshot's alt text; nothing inside is focusable. */
function Specimen({ specimen }: { specimen: FeatureSpecimen }) {
  const description = `Sample screen, ${specimen.label}, ${specimen.sub}: ${specimen.rows.map(row => `${row.name}, ${row.meta}, ${row.status}`).join("; ")}.`
  return (
    <div className="oc-ledger-specimen" role="img" aria-label={description}>
      <div className="oc-ledger-specimen-header"><p>{specimen.label}</p><p>{specimen.sub}</p></div>
      <ul>
        {specimen.rows.map(row => (
          <li key={row.name}>
            <div><p className="oc-ledger-specimen-name">{row.name}</p><p className="oc-ledger-specimen-meta">{row.meta}</p></div>
            <StatusMark label={row.status} tone={row.tone} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The navy decision moment, "A season on Grounds" and the feature ledger (docs/public-site/redesign/Main.mockup.html). */
export function LandingMoments({ perspective }: { perspective: LandingPerspective }) {
  const moment = decisionMoment[perspective]
  const features = featureGrid[perspective]
  return (
    <>
      <section className="oc-moments-section" aria-labelledby="moment-title">
        <div className="oc-moment">
          <div className="oc-moment-copy">
            <p className="oc-moment-kicker">{moment.kicker}</p>
            <h2 id="moment-title">{moment.title}</h2>
            <p>{moment.body}</p>
          </div>
          <div className="oc-moment-frame oc-public-glass-navy">
            {perspective === "leader" ? <VoteIllustration /> : <OfferIllustration />}
          </div>
        </div>
      </section>

      <section className="oc-moments-section" aria-labelledby="season-title">
        <div className="oc-moments-heading oc-season-heading">
          <div>
            <p className="oc-moments-kicker">{recruitmentSeason.kicker}</p>
            <h2 id="season-title">{recruitmentSeason.title}</h2>
          </div>
          <p className="oc-moments-caption" id="season-caption">{recruitmentSeason.caption}</p>
        </div>
        <ol className="oc-season" aria-describedby="season-caption">
          {recruitmentSeason.steps.map(step => (
            <li key={step.numeral} className="oc-season-step">
              <span className="oc-season-numeral" aria-hidden="true">{step.numeral}</span>
              <span className="oc-season-title">{step.title}</span>
              <span className="oc-season-body">{step.body}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="oc-moments-section" aria-labelledby="features-title">
        <div className="oc-moments-heading">
          <div>
            <p className="oc-moments-kicker">{features.kicker}</p>
            <h2 id="features-title">{features.title}</h2>
          </div>
        </div>
        {/* An editorial ledger, not a card grid: each feature is a ruled row pairing its copy with a fragment of
            the product, alternating sides on wide screens (stacked below 820px). */}
        <ol className="oc-ledger">
          {features.features.map((feature, i) => (
            <li key={feature.title} className="oc-ledger-row">
              <div className="oc-ledger-copy">
                <span className="oc-ledger-numeral" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </div>
              <Specimen specimen={feature.specimen} />
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
