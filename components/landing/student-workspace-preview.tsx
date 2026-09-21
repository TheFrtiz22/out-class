import { ArrowUpRight, CalendarDays, ChevronRight, FileText } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { OutClassLogo } from "@/components/outclass-logo"
import { studentNav } from "@/lib/views"

const applications = [
  { name: "Virginia Venture Fund", initials: "VVF", status: "Interview invited", next: "Choose an interview time", variant: "info" as const },
  { name: "180 Degrees Consulting", initials: "180", status: "In review", next: "Application submitted", variant: "secondary" as const },
  { name: "McIntire Investment Institute", initials: "MII", status: "Draft", next: "Finish your short response", variant: "warning" as const },
]

/** Deliberately illustrative: no real user records, fake controls, or nested app. */
export function StudentWorkspacePreview() {
  return <figure className="oc-student-preview" aria-label="Example student recruitment workspace">
    <div className="oc-preview-frame">
      <aside className="oc-preview-sidebar" aria-label="Example workspace navigation">
        <OutClassLogo className="h-8 w-auto" />
        <p className="oc-preview-campus">University of Virginia</p>
        <div className="oc-preview-nav" aria-hidden="true">{studentNav.map(({ id, title, icon: Icon }) => <div key={id} data-active={id === "student-dashboard"}><Icon size={16} strokeWidth={1.65} /><span>{title}</span></div>)}</div>
        <div className="oc-preview-identity"><Avatar><AvatarFallback>JA</AvatarFallback></Avatar><div><strong>Jordan Avery</strong><span>Student workspace</span></div></div>
      </aside>
      <div className="oc-preview-main">
        <div className="oc-preview-top"><span>My workspace <ChevronRight size={12} aria-hidden="true" /> <strong>Home</strong></span><span>Fall recruitment <span className="oc-preview-term-dot" /></span></div>
        <div className="oc-preview-content">
          <div className="oc-preview-greeting"><div><p>Your next chapter</p><h2>A little clarity for what’s next.</h2></div><Badge variant="outline">3 applications</Badge></div>
          <div className="oc-preview-grid">
            <section className="oc-preview-applications" aria-label="Example applications">
              <div className="oc-preview-section-label"><h3>Your applications</h3><FileText size={15} aria-hidden="true" /></div>
              <ul>{applications.map(app => <li key={app.name}>
                <span className="oc-preview-club-mark" aria-hidden="true">{app.initials}</span>
                <div className="oc-preview-club-copy"><h4>{app.name}</h4><p>{app.next}</p></div>
                <Badge variant={app.variant}>{app.status}</Badge>
              </li>)}</ul>
              <div className="oc-preview-profile"><div><span>One profile, ready to go</span><strong>80%</strong></div><Progress value={80} aria-label="Example profile completion" /><p>Add your experience to complete your profile.</p></div>
            </section>
            <section className="oc-preview-upcoming" aria-label="Example upcoming events">
              <div className="oc-preview-section-label"><h3>Coming up</h3><CalendarDays size={15} aria-hidden="true" /></div>
              <div className="oc-preview-event"><span className="oc-preview-date">SEP<strong>24</strong></span><div><h4>Meet the team</h4><p>180 Degrees Consulting</p><span>5:00 PM · On Grounds</span></div></div>
              <div className="oc-preview-event"><span className="oc-preview-date">SEP<strong>26</strong></span><div><h4>First-round interview</h4><p>Virginia Venture Fund</p><span>Choose your time</span></div></div>
              <div className="oc-preview-discover"><span>Still exploring?</span><p>Find a club that shares your curiosity.</p><a href="/preview/?view=student-dashboard">Explore the student demo <ArrowUpRight size={14} aria-hidden="true" /></a></div>
            </section>
          </div>
        </div>
      </div>
    </div>
    <figcaption><span>One place to find your next step.</span><span>Illustrative workspace · sample information</span></figcaption>
  </figure>
}
