"use client"

import type { ReactNode } from "react"
import Image from "next/image"
import { ArrowRight, CalendarDays, Check, CheckCircle2, FileText, MapPin, Users } from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { useDemoState } from "./product-motion"
import { journeySample as sample } from "./journey-example-state"
import { journeyExample as example, type JourneyScene } from "./journey-content"

function Club() {
  return <div className="oc-demo-club"><Image src={example.clubLogo} alt="" width={48} height={48} /><div><h3>{example.club}</h3><p>University of Virginia</p></div></div>
}
function Person({ subtitle = "Economics · Second year" }: { subtitle?: string }) {
  return <div className="oc-demo-person"><Image src={example.headshot} alt="" width={48} height={48} /><div><h3>{example.person}</h3><p>{subtitle}</p></div></div>
}
function Facts({ items }: { items: [string, ReactNode][] }) {
  return <dl className="oc-demo-facts">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}
function Action({ children, target, done }: { children: ReactNode; target: string; done: boolean }) {
  return <span className="oc-demo-button" data-demo-target={target} data-complete={done}>{children}{done ? <Check size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}</span>
}
function Result({ children, done }: { children: ReactNode; done: boolean }) {
  return <div className="oc-demo-result" data-visible={done} data-demo-entering={done}><CheckCircle2 size={20} /><p>{children}</p></div>
}
/** One stable product crop, one focal control, one explicit outcome. */
function Focus({ eyebrow, title, badge, children, target, action, result, done }: { eyebrow: string; title: string; badge?: string; children: ReactNode; target: string; action: string; result: string; done: boolean }) {
  return <>
    <div className="oc-demo-heading"><div><p className="oc-demo-eyebrow">{eyebrow}</p><h3>{title}</h3></div>{badge && <Badge variant={done ? "success" : "outline"}>{badge}</Badge>}</div>
    <div className="oc-demo-focus">{children}</div>
    <div className="oc-demo-outcome"><Result done={done}>{result}</Result><Action target={target} done={done}>{action}</Action></div>
  </>
}

function DiscoverScene() {
  const done = useDemoState() > 0
  return <Focus eyebrow="DISCOVER · FINANCE & INVESTING" title={done ? "Get to know your next club." : "Find a club that fits."} target="view-club" action={done ? "Club profile opened" : "View club"} result="Recruitment is open. Find your fit before applying." done={done}>
    <div className="oc-demo-discovery">
      <Club />
      <p className="oc-demo-description">Research ideas. Build conviction. Learn together.</p>
      <div className="oc-demo-reveal" data-visible={done} data-demo-entering={done}><Facts items={[["Focus", "Finance & investing"], ["Recruitment", "Applications open"]]} /></div>
    </div>
  </Focus>
}
function ApplyScene() {
  const done = useDemoState() > 0
  return <Focus eyebrow="JIS · REVIEW YOUR APPLICATION" title={done ? "Application submitted." : "Your introduction is ready."} badge={done ? "Submitted" : "Ready"} target="submit-application" action={done ? "Application submitted" : "Submit application"} result="Your profile and response are ready for club review." done={done}>
    <div className="oc-demo-profile-attached"><CheckCircle2 size={20} /><div><strong>Shared profile & resume attached</strong><p>{example.person} · Economics</p></div></div>
    <blockquote className="oc-demo-answer"><span>{sample.question}</span>I want to turn research into a clear recommendation…</blockquote>
  </Focus>
}
function InterviewScene() {
  const done = useDemoState() > 0
  return <Focus eyebrow="JIS · PANEL INTERVIEW" title={done ? "Interview confirmed." : "A time that works for you."} badge={done ? "Confirmed" : "Selected"} target="confirm-booking" action={done ? "Interview confirmed" : "Confirm interview"} result="Your booking is saved with your application." done={done}>
    <div className="oc-demo-booking"><CalendarDays size={28} /><div><strong>Thursday, October 22</strong><p>{sample.time} · Eastern Time</p></div></div>
    <Facts items={[["Location", <span className="oc-demo-inline" key="room"><MapPin size={18} />{example.room}</span>], ["Duration", "20 minutes"]]} />
  </Focus>
}
function StatusScene() {
  const done = useDemoState() > 0
  return <Focus eyebrow="YOUR APPLICATIONS · STATUS" title="Know your next step." badge="Interviewing" target="status-application" action={done ? "Application details opened" : "View application"} result="Interview confirmed. Your next step is in view." done={done}>
    <Club />

    <div className="oc-demo-reveal" data-visible={done} data-demo-entering={done}><div className="oc-demo-next-step"><CalendarDays size={22} /><div><strong>Thursday · {sample.time}</strong><p>Confirmed · {example.room}</p></div></div></div>
  </Focus>
}
function JoinScene() {
  const done = useDemoState() > 0
  return <Focus eyebrow="JIS · MEMBERSHIP OFFER" title={done ? "Welcome to the team." : "There’s a place for you."} badge={done ? "Member" : "Accepted"} target="accept-offer" action={done ? "Offer accepted" : "Accept offer"} result="Membership active. Your club workspace is ready." done={done}>
    <Club />
    <Facts items={[["Your offer", "General member"], ["Membership", done ? "Active" : "Awaiting your response"]]} />
    <p className="oc-demo-description">{done ? "Your next chapter with JIS starts here." : "JIS has accepted your application. Accept the offer to join."}</p>
  </Focus>
}
function BuildScene() {
  const done = useDemoState() > 0
  return <Focus eyebrow="APPROVED WORKSPACE · CLUB PROFILE" title={done ? "Your club, ready to discover." : "Introduce your club."} target="save-profile" action={done ? "Club profile saved" : "Save club profile"} result="Your updated description is on the club profile." done={done}>
    <Club />
    <div className="oc-demo-field"><span>Club description</span><div className="oc-demo-field-value">{sample.description.split(". ")[0]}.</div></div>
  </Focus>
}
function RecruitScene() {
  const done = useDemoState() > 0
  return <Focus eyebrow="JIS · APPLICATION SETTINGS" title="Ask what matters to your club." target="save-application" action={done ? "Application saved" : "Save application"} result="Required question saved to your club’s application." done={done}>
    <div className="oc-demo-field"><span>Short response question</span><div className="oc-demo-field-value">{sample.question}</div></div>
    <div className="oc-demo-required"><span><Check size={16} /></span>Required response</div>
    <div className="oc-demo-profile-attached"><FileText size={22} /><div><strong>Shared student profile included</strong><p>Academics · Experience · Resume</p></div></div>
  </Focus>
}
function ReviewScene() {
  const done = useDemoState() > 0
  return <Focus eyebrow="JIS · APPLICANT EVALUATION" title={done ? "A shared point of reference." : "Give every review structure."} target="save-evaluation" action={done ? "Evaluation saved" : "Save evaluation"} result="Jordan’s scores and note are saved for your team." done={done}>
    <Person />
    <div className="oc-demo-rubric">{[["Motivation & fit", 4]].map(([label, score]) => <div key={label}><span>{label}</span><strong>{score}<span> / 5</span></strong></div>)}</div>
    <p className="oc-demo-review-note">“Clear curiosity. Thoughtful research.”</p>
  </Focus>
}
function LeaderInterviewScene() {
  const done = useDemoState() > 0
  return <Focus eyebrow="JIS · INTERVIEW PANELS" title={done ? "A proposal to review." : "A plan for every panel."} badge={done ? "Draft" : "Ready"} target="auto-fill" action={done ? "Panel proposal created" : "Auto-Fill Panels"} result="Draft ready. Owner review before publication." done={done}>
    <div className="oc-demo-schedule-context"><span><MapPin size={18} />Room 204</span><span><Users size={18} />2 interviewers per session</span></div>
    <div className="oc-demo-panel-table"><div><span>Thursday, Oct 22</span><span>Panel assignment</span></div>{["6:00 PM", sample.time].map(time => <div key={time}><strong>{time}</strong><span data-demo-entering={done}>{done ? "Alex J. · Sam K." : "Ready to auto-fill"}</span></div>)}</div>
    <p className="oc-demo-schedule-status">{done ? "4 of 4 staffed · 0 hard conflicts · Unpublished" : "Alex J. & Sam K. · Available 6–8 PM"}</p>
  </Focus>
}
function DecideScene() {
  const done = useDemoState() > 0
  return <Focus eyebrow="JIS · FINAL DECISION" title={done ? "An offer. A new possibility." : "Decide with confidence."} target="record-decision" action={done ? "Decision recorded" : "Record decision"} result="Offer pending. Membership begins when Jordan accepts." done={done}>
    <Person />
    <div className="oc-demo-evaluation-summary"><div><strong>4.5 <span>/ 5</span></strong><span>Team evaluation</span></div><div><strong>4</strong><span>Reviewers</span></div></div>
    <div className="oc-demo-status-summary"><span>{done ? "Decision recorded" : "Selected decision"}</span><Badge variant="success">Accepted</Badge></div>
  </Focus>
}
function ManageScene() {
  const done = useDemoState() > 0
  return <Focus eyebrow="JIS · TASKS · REVIEW & ASSIGN" title={done ? "A clear next step." : "Start your members strong."} target="assign-task" action={done ? "Assigned to 3 members" : "Assign to 3 members"} result="Welcome brief assigned. Track each member’s progress." done={done}>
    <div className="oc-demo-task"><FileText size={26} /><div><h4>Read the welcome brief</h4><p>Due October 22 · 6 PM</p></div></div>
    <div className="oc-demo-recipients"><p className="oc-demo-eyebrow">REVIEWED RECIPIENTS</p><Person subtitle={done ? "Assigned · Awaiting submission" : "General member"} /><p>+ Maya Patel & Noah Williams</p></div>
  </Focus>
}

export function JourneyScenePreview({ scene }: { scene: JourneyScene }) {
  switch (scene) {
    case "discover": return <DiscoverScene />
    case "profile":
    case "apply": return <ApplyScene />
    case "student-interview": return <InterviewScene />
    case "status": return <StatusScene />
    case "join": return <JoinScene />
    case "build": return <BuildScene />
    case "recruit": return <RecruitScene />
    case "review": return <ReviewScene />
    case "schedule":
    case "leader-interview": return <LeaderInterviewScene />
    case "decide": return <DecideScene />
    case "manage": return <ManageScene />
  }
}
