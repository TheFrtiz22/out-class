import Image from "next/image"
import { ArrowRight, CalendarDays } from "lucide-react"

/** Sample product states, deliberately outside the login keyboard path. */
export function ProductPreviewCards() {
  return (
    <div className="oc-login-previews" role="img" aria-label="Example OutClass workspace: discover Virginia Consulting Group, track a TAMID application at the interview stage, and see an upcoming McIntire Investment Institute interview.">
      <div className="oc-login-preview oc-login-preview-discovery" aria-hidden="true">
        <p className="oc-login-preview-context">Explore clubs</p>
        <div className="oc-login-preview-club">
          <span className="oc-login-club-mark">VCG</span>
          <h3>Virginia<br />Consulting Group</h3>
        </div>
        <p className="oc-login-preview-deadline">Applications close Friday</p>
        <span className="oc-login-preview-link">View club <ArrowRight size={14} /></span>
      </div>

      <div className="oc-login-preview oc-login-preview-application" aria-hidden="true">
        <p className="oc-login-preview-context">Your applications</p>
        <div className="oc-login-preview-application-heading">
          <h3>TAMID</h3>
          <span className="oc-login-preview-status"><i />Interview</span>
        </div>
        <p className="oc-login-preview-update">Application updated</p>
        <div className="oc-login-preview-progress"><span /><span /><span /></div>
      </div>

      <div className="oc-login-preview oc-login-preview-interview" aria-hidden="true">
        <p className="oc-login-preview-context">Coming up</p>
        <div className="oc-login-preview-club">
          <Image src="/logos/mii.webp" alt="" width={38} height={38} className="oc-login-club-logo" />
          <h3>McIntire<br />Investment Institute</h3>
        </div>
        <div className="oc-login-preview-event"><span>Interview</span><span><CalendarDays size={14} />Tomorrow · 4:00 PM</span></div>
      </div>
    </div>
  )
}
