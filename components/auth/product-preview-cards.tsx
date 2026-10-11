import { CalendarDays, Check } from "lucide-react"

/** A visibly illustrative product state, never represented as live club activity. */
export function ProductPreviewCards() {
  return (
    <aside className="oc-login-example" aria-label="Illustrative application status preview">
      <div className="oc-login-example-caption">
        <span>OUTCLASS / APPLICATION STATUS</span>
        <strong>ILLUSTRATIVE EXAMPLE</strong>
      </div>
      <div className="oc-login-example-heading">
        <div>
          <p>Student workspace</p>
          <h3>Sample club application</h3>
        </div>
        <span className="oc-login-example-state">In review</span>
      </div>
      <ol className="oc-login-example-steps" aria-label="Example application progress">
        <li><span className="oc-login-example-step-mark"><Check size={14} aria-hidden="true" /></span><span>Application submitted</span></li>
        <li aria-current="step"><span className="oc-login-example-step-mark" /><span>Club review in progress</span></li>
        <li><span className="oc-login-example-step-mark"><CalendarDays size={13} aria-hidden="true" /></span><span>Interview details, if invited</span></li>
      </ol>
      <p className="oc-login-example-footnote">This is an example of the workspace, not a real student’s application.</p>
    </aside>
  )
}
