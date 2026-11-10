import { CalendarDays, Check } from "@/components/icons"

/** A visibly illustrative product state, never represented as live club activity. */
export function ProductPreviewCards() {
  return (
    <div className="oc-login-example" role="group" aria-label="Sample application status">
      <div className="oc-login-example-caption">
        <span>OUTCLASS / APPLICATION STATUS</span>
        <strong>SAMPLE</strong>
      </div>
      <div className="oc-login-example-heading">
        <div>
          <p>Student workspace</p>
          <p className="oc-login-example-name">Sample club application</p>
        </div>
        <span className="oc-login-example-state">In review</span>
      </div>
      <ol className="oc-login-example-steps" aria-label="Example application progress">
        <li><span className="oc-login-example-step-mark"><Check size={14} aria-hidden="true" /></span><span>Application submitted</span></li>
        <li aria-current="step"><span className="oc-login-example-step-mark" /><span>Club review in progress</span></li>
        <li><span className="oc-login-example-step-mark"><CalendarDays size={13} aria-hidden="true" /></span><span>Interview details, if invited</span></li>
      </ol>
      <p className="oc-login-example-footnote">Sample data, not a real student’s application.</p>
    </div>
  )
}
