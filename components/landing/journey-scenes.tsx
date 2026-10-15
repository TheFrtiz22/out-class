"use client"

import { Children, type ReactNode } from "react"
import Image from "next/image"
import { ArrowRight, CalendarDays, Check, CheckCircle2, ChevronDown, Clock3, FileText, MapPin, Search, ShieldCheck, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useDemoState } from "./product-motion"
import { journeySample as sample } from "./journey-example-state"
import { journeyExample as example, type JourneyScene } from "./journey-content"

function Club({ status }: { status?: string }) {
  return <div className="oc-demo-club"><Image src={example.clubLogo} alt="" width={40} height={40} /><div><h3>{example.club}</h3><p>Fall recruitment · University of Virginia</p></div>{status && <Badge variant="outline">{status}</Badge>}</div>
}
function Person({ subtitle = "Economics · Second year" }: { subtitle?: string }) {
  return <div className="oc-demo-person"><Image src={example.headshot} alt="" width={40} height={40} /><div><h3>{example.person}</h3><p>{subtitle}</p></div></div>
}
function Notice({ children, success = false }: { children: ReactNode; success?: boolean }) {
  return <div className="oc-demo-notice" data-success={success}>{success ? <CheckCircle2 size={16} /> : <ShieldCheck size={16} />}<p>{children}</p></div>
}
function Facts({ items }: { items: [string, ReactNode][] }) {
  return <dl className="oc-demo-facts">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}
function Action({ children, target, secondary = false, disabled = false }: { children: ReactNode; target?: string; secondary?: boolean; disabled?: boolean }) {
  return <button type="button" tabIndex={-1} className="oc-demo-button" data-demo-target={target} data-secondary={secondary} disabled={disabled}>{children}</button>
}
/** All views reserve their layout. The enclosing observational surface is inert. */
function Views({ active, children }: { active: number; children: ReactNode }) {
  return <div className="oc-demo-views">{Children.toArray(children).map((child, index) => <div key={index} data-demo-view={index === active} aria-hidden={index !== active}>{child}</div>)}</div>
}
function Tabs({ labels, active, targets = [] }: { labels: string[]; active: number; targets?: (string | undefined)[] }) {
  return <div className="oc-demo-tabs">{labels.map((label, index) => <button type="button" tabIndex={-1} key={label} data-demo-target={targets[index]} aria-pressed={index === active}>{label}</button>)}</div>
}
function Applicants({ target, selected = false }: { target: string; selected?: boolean }) {
  return <div className="oc-demo-table"><div className="oc-demo-table-head"><span>Applicant</span><span>Current stage</span></div>{[[example.person, "In review"], ["Maya Patel", "Interview"], ["Noah Williams", "In review"]].map(([name, status]) => <div key={name} data-demo-target={name === example.person ? target : undefined} data-selected={name === example.person && selected}><span>{name}{name === example.person && <small>Economics · Second year</small>}</span><span><Badge variant={status === "Interview" ? "info" : "secondary"}>{status}</Badge></span></div>)}</div>
}

function DiscoverScene() {
  const state = useDemoState(), profile = state >= 3
  return <>
    <div className="oc-demo-heading"><div><p className="oc-demo-eyebrow">DISCOVER</p><h3>Find your kind of curious.</h3></div><Badge variant="outline">UVA</Badge></div>
    <Views active={profile ? 1 : 0}>
      <div><label className="oc-demo-search"><Search size={16} /><input readOnly tabIndex={-1} type="search" data-demo-target="search" placeholder="Search clubs or interests" value={state >= 1 ? "investment" : ""} /></label><div className="oc-demo-filter-line"><span>All interests</span><span>Applications open</span></div><ul className="oc-demo-club-list">{[{ name: example.club, logo: example.clubLogo, category: "Finance", copy: "Research ideas. Build conviction. Learn together." }, { name: example.consultingClub, logo: example.consultingClubLogo, category: "Consulting", copy: "Fresh thinking for organizations creating social impact." }].map((club, index) => <li key={club.name} data-demo-target={index === 0 ? "club-row" : undefined} data-filtered={index === 1 && state >= 1} data-selected={index === 0 && state >= 2}><Image src={club.logo} alt="" width={40} height={40} /><div><h4>{club.name}</h4><p>{club.copy}</p><Badge variant="outline">{club.category}</Badge></div>{index === 0 && <Action target="view-club">View club</Action>}</li>)}</ul></div>
      <div><Club status="Applications open" /><p className="oc-demo-description">An investment community built around research, discussion, and learning by doing.</p><Facts items={[["Interest", "Finance & investing"], ["Application", "Shared profile + one short response"], ["Recruitment", "Review → Panel interview → Decision"]]} /><Notice>Get to know the organization before you apply.</Notice><Action>Start application <ArrowRight size={14} /></Action></div>
    </Views>
    <div className="oc-demo-actions"><span className="oc-demo-small">{profile ? "A shared introduction. A specific application." : "Participating organizations · University of Virginia"}</span></div>
  </>
}

function ApplyScene() {
  const state = useDemoState(), view = state >= 4 ? 2 : state >= 3 ? 1 : 0
  return <>
    <Club status={view === 2 ? "Submitted" : view === 1 ? "Ready to submit" : "Draft"} />
    <Views active={view}>
      <div><div className="oc-demo-profile-attached"><CheckCircle2 size={18} /><div><strong>Your shared profile is attached</strong><p>Academics · Experience · Resume</p></div></div><label className="oc-demo-field">{sample.question}<textarea readOnly tabIndex={-1} data-demo-target="answer" value={state >= 1 ? sample.answer : ""} placeholder="Your club-specific response" /></label><p className="oc-demo-small">Club-specific question · Required</p><p className="oc-demo-feedback" data-visible={state >= 2} data-demo-entering={state === 2}>Draft saved. You can return before submitting.</p></div>
      <div><p className="oc-demo-eyebrow">REVIEW YOUR APPLICATION</p><Person /><Facts items={[["Shared profile", "Attached"], ["Resume", "Jordan_Avery_Resume.pdf"], ["Required response", "Complete"]]} /><blockquote className="oc-demo-answer">{sample.answer}</blockquote><Notice>Review your responses, then submit to this club.</Notice></div>
      <div><div className="oc-demo-success"><CheckCircle2 size={28} /><h3>Application submitted.</h3><p>Your profile and response are together, ready for the club’s review.</p></div><Facts items={[["Applicant", example.person], ["Current status", "Submitted"], ["Next step", "Await club review"]]} /><Notice success>Saved in Your applications. Follow updates in Status.</Notice></div>
    </Views>
    <div className="oc-demo-actions"><Action target="save-draft" secondary disabled={view > 0}>{view === 0 ? "Save draft" : "Draft saved"}</Action><Action target={view === 0 ? "review-application" : "submit-application"} disabled={view === 2 || state < 1}>{view === 0 ? "Review & submit" : view === 1 ? "Submit application" : "Application submitted"}{view === 2 && <Check size={14} />}</Action></div>
  </>
}

function InterviewScene() {
  const state = useDemoState(), view = state >= 3 ? 2 : state >= 1 ? 1 : 0
  return <>
    <Club status={view === 2 ? "Scheduled" : "Interview invited"} />
    <Views active={view}>
      <div><p className="oc-demo-eyebrow">YOUR NEXT INTERVIEW</p><h3>Meet the people behind JIS.</h3><p className="oc-demo-description">You’ve been invited to the panel interview round. Choose an available session that works for you.</p><Facts items={[["Round", "Panel interview"], ["Date", "Thursday, October 22"], ["Location", example.room]]} /><Notice>Your invitation links directly to available interview times.</Notice><Action target="open-invitation">Choose interview time <ArrowRight size={14} /></Action></div>
      <div><div className="oc-demo-heading"><div><p className="oc-demo-eyebrow">CHOOSE YOUR INTERVIEW</p><h3>Thursday · October 22</h3></div><CalendarDays size={20} /></div><p className="oc-demo-small">Eastern Time · 20 minute interviews</p><div className="oc-demo-date-strip"><span>Wed<strong>21</strong></span><span data-selected="true">Thu<strong>22</strong></span><span>Fri<strong>23</strong></span></div><div className="oc-demo-times">{["6:00 PM", "6:30 PM", "7:00 PM"].map(time => <button type="button" tabIndex={-1} key={time} data-demo-target={time === sample.time ? "time-choice" : undefined} aria-pressed={state >= 2 && time === sample.time}><strong>{time}</strong><span>{example.room}</span></button>)}</div><Notice>Choose an available time, then confirm your booking.</Notice><Action target="confirm-booking" disabled={state < 2}>Confirm interview</Action></div>
      <div><div className="oc-demo-success"><CheckCircle2 size={28} /><h3>Interview confirmed.</h3><p>One less thing to coordinate.</p></div><div className="oc-demo-booking"><CalendarDays size={20} /><div><strong>Thursday · {sample.time}</strong><p>October 22 · Eastern Time</p></div></div><Facts items={[["Location", example.room], ["Duration", "20 minutes"], ["Next step", "Meet your interview panel"]]} /><Notice success>Your booking and interview details stay together.</Notice></div>
    </Views>
  </>
}

function StatusScene() {
  const state = useDemoState()
  return <>
    <div className="oc-demo-heading"><div><p className="oc-demo-eyebrow">STATUS</p><h3>Your next step, in view.</h3></div><Badge variant="outline">2 applications</Badge></div>
    <Views active={Math.min(state, 2)}>
      <div><div className="oc-demo-status-card" data-demo-target="status-application"><Club status="Interviewing" /><p>Panel interview · Invitation received</p><span>View application <ArrowRight size={14} /></span></div><div className="oc-demo-other-club"><Image src={example.consultingClubLogo} alt="" width={28} height={28} /><span>{example.consultingClub}</span><Badge variant="secondary">In review</Badge></div><Notice>Every submitted application has its own current status.</Notice></div>
      <div><Club status="Interviewing" /><ol className="oc-demo-status-path">{["Submitted", "In review", "Interview", "Decision"].map((label, index) => <li key={label} data-complete={index < 2} aria-current={index === 2 ? "step" : undefined}><span>{index < 2 ? <Check size={12} /> : index + 1}</span>{label}</li>)}</ol><Facts items={[["Current round", "Panel interview"], ["Interview status", "Confirmed"], ["Next step", "Attend your interview"]]} /><Action target="interview-details">View interview details <ArrowRight size={14} /></Action></div>
      <div><Club status="Interviewing" /><div className="oc-demo-booking"><CalendarDays size={20} /><div><strong>Thursday · {sample.time}</strong><p>Confirmed · {example.room} · 20 minutes</p></div></div><Facts items={[["Club", example.clubMark], ["Current round", "Panel interview"], ["Next step", "Attend your confirmed session"]]} /><Notice success>Keep the booking and the application together.</Notice></div>
    </Views>
  </>
}

function JoinScene() {
  const state = useDemoState()
  return <>
    <Club status={state === 0 ? "Offer pending" : "Member"} />
    <Views active={Math.min(state, 3)}>
      <div><p className="oc-demo-eyebrow">YOUR MEMBERSHIP OFFER</p><h3>There’s a place for you here.</h3><p className="oc-demo-description">After final review, JIS has accepted your application. Review the offer and choose whether to join.</p><Facts items={[["Decision", "Accepted"], ["Offer", "Awaiting your response"], ["Access after acceptance", "General member"]]} /><Notice>Your decision to accept the offer creates your membership.</Notice><Action target="accept-offer">Accept offer</Action></div>
      <div><div className="oc-demo-success"><CheckCircle2 size={28} /><h3>Welcome to JIS.</h3><p>Offer accepted. Your member access is ready.</p></div><Facts items={[["Organization", example.club], ["Member status", "Active"], ["Member title", "General member"]]} /><Action target="my-clubs">Open My Clubs <ArrowRight size={14} /></Action></div>
      <div><p className="oc-demo-eyebrow">MY CLUBS</p><div className="oc-demo-member-card"><Users size={22} /><div><h3>{example.club}</h3><p>General member · Your joined organization</p></div></div><Facts items={[["Next meeting", "New member welcome · Thursday, 6 PM"], ["Your first task", "Read the welcome brief"]]} /><Action target="member-workspace">Open member workspace <ArrowRight size={14} /></Action></div>
      <div><p className="oc-demo-eyebrow">MEMBER WORKSPACE</p><h3>Your next chapter starts here.</h3><div className="oc-demo-welcome-post"><span>ANNOUNCEMENT · ALEX J.</span><h4>Welcome to the team.</h4><p>Meet your new class at Thursday’s welcome. Read the brief before our first research project.</p></div><Facts items={[["Meeting", "New member welcome · Thursday, 6 PM"], ["Your task", "Read the welcome brief"], ["Access", "General member"]]} /></div>
    </Views>
  </>
}

function BuildScene() {
  const state = useDemoState(), editing = state === 1 || state === 2
  return <>
    <Club status="Approved workspace" />
    <Tabs labels={["Club profile", "Recruitment"]} active={0} />
    <Views active={editing ? 1 : 0}>
      <div><p className="oc-demo-description">An investment community built around research, discussion, and learning by doing. <span className="oc-demo-description-addition" data-visible={state >= 3}>Join weekly research discussions and build a recommendation with your team.</span></p><Facts items={[["Interest", "Finance & investing"], ["Campus", "University of Virginia"], ["Workspace access", "Club owner"]]} /><Notice>Sample club claim approved. Pending claims do not grant access.</Notice><p className="oc-demo-feedback" data-visible={state >= 3} data-demo-entering={state === 3}>Club profile saved.</p></div>
      <div><label className="oc-demo-field">Club name<input readOnly tabIndex={-1} value={example.club} /></label><label className="oc-demo-field">Club description<textarea readOnly tabIndex={-1} data-demo-target="club-description" value={state >= 2 ? sample.description : "An investment community built around research, discussion, and learning by doing. "} placeholder="Introduce your organization" /></label><Facts items={[["Interest", "Finance & investing"], ["Campus", "University of Virginia"]]} /><Notice>Update the public profile from your approved club workspace.</Notice></div>
    </Views>
    <div className="oc-demo-actions"><Action target={editing ? "save-profile" : "edit-profile"} disabled={state >= 3}>{state >= 3 ? "Profile saved" : editing ? "Save club profile" : "Edit club profile"}{state >= 3 && <Check size={14} />}</Action></div>
  </>
}

function RecruitScene() {
  const state = useDemoState(), pipeline = state >= 3
  return <>
    <Club status="Recruitment open" />
    <Tabs labels={["Application", "Applicants"]} active={pipeline ? 1 : 0} targets={[undefined, "applicants-tab"]} />
    <Views active={pipeline ? 1 : 0}>
      <div><p className="oc-demo-eyebrow">YOUR APPLICATION</p><label className="oc-demo-field">Short response question<input readOnly tabIndex={-1} data-demo-target="application-question" value={state >= 1 ? sample.question : ""} placeholder="Add your club’s question" /></label><label className="oc-demo-checkbox"><input readOnly tabIndex={-1} type="checkbox" checked />Required response</label><p className="oc-demo-small">Shared student profile and resume included.</p><div className="oc-demo-rounds"><span>Application review</span><ArrowRight size={14} /><span>Panel interview</span><ArrowRight size={14} /><span>Decision</span></div><p className="oc-demo-feedback" data-visible={state >= 2} data-demo-entering={state === 2}>Application settings saved.</p><Action target="save-application" disabled={state < 1}>Save application</Action></div>
      <div><div className="oc-demo-metrics"><div><strong>22</strong><span>Submitted</span></div><div><strong>12</strong><span>In review</span></div><div><strong>8</strong><span>Interview</span></div><div><strong>2</strong><span>Decided</span></div></div><Applicants target="recruit-applicant" selected={state >= 4} /><p className="oc-demo-feedback" data-visible={state >= 4} data-demo-entering={state === 4}>Jordan Avery selected · Ready for application review</p><Notice>Clear questions and rounds. One organized applicant pool.</Notice></div>
    </Views>
  </>
}

function ReviewScene() {
  const state = useDemoState(), view = state === 0 ? 0 : state === 1 ? 1 : 2
  return <>
    <div className="oc-demo-heading"><p className="oc-demo-eyebrow">APPLICATION REVIEW · ROUND 1</p><Badge variant="outline">{state >= 5 ? "Evaluated" : "In review"}</Badge></div>
    <Views active={view}>
      <div><Applicants target="review-applicant" /><Notice>Read the shared profile and club-specific response together.</Notice></div>
      <div><Person /><Tabs labels={["Application", "Evaluation"]} active={0} targets={[undefined, "evaluation-tab"]} /><blockquote className="oc-demo-answer"><span>{sample.question}</span>{sample.answer}</blockquote><Facts items={[["Shared profile", "Economics · Second year"], ["Resume", "Jordan_Avery_Resume.pdf"]]} /></div>
      <div><Person /><Tabs labels={["Application", "Evaluation"]} active={1} /><div className="oc-demo-rubric">{["Motivation & fit", "Problem solving", "Collaboration"].map((label, index) => <div className="oc-demo-score-row" key={label}><span>{label}</span><div className="oc-demo-select-wrap"><button type="button" tabIndex={-1} className="oc-demo-select" data-demo-target={index === 0 ? "rubric-score" : undefined}>{index === 0 ? state >= 4 ? 4 : 3 : index === 1 ? 5 : 4} / 5 <ChevronDown size={12} /></button>{index === 0 && <div className="oc-demo-select-options" data-open={state === 3}>{[1,2,3,4,5].map(score => <button type="button" tabIndex={-1} key={score} data-demo-target={score === 4 ? "score-four" : undefined}>{score} / 5{score === 3 && <Check size={12} />}</button>)}</div>}</div></div>)}</div><label className="oc-demo-field oc-demo-field-compact">Reviewer note<textarea readOnly tabIndex={-1} value="Clear curiosity. Thoughtful research experience." /></label><p className="oc-demo-feedback" data-visible={state >= 5} data-demo-entering={state === 5}>Evaluation saved.</p><Action target="save-evaluation" disabled={state >= 5}>{state >= 5 ? "Evaluation saved" : "Save evaluation"}{state >= 5 && <Check size={14} />}</Action></div>
    </Views>
  </>
}

function PanelRows({ state }: { state: number }) {
  const published = state >= 7
  return <div className="oc-demo-table oc-demo-panel-table"><div className="oc-demo-table-head"><span>Time · Room 204</span><span>Panel assignment</span></div>{["6:00 PM",sample.time].map((time,index) => <div key={time} data-demo-target={!published && index === 1 ? "edit-session" : undefined} data-selected={!published && index === 1 && state >= 3}><span><strong>{time}</strong><small>{published ? index === 1 ? example.person : "Noah Williams" : "Thursday · 20 minutes"}</small></span><span>Alex J. · {index === 1 && state >= 5 ? "Naomi R." : "Sam K."}<small>{published ? "Published · 2 assigned" : "Proposed · 2 of 2 staffed"}</small></span></div>)}</div>
}
function LeaderInterviewScene() {
  const state = useDemoState(), view = state === 0 ? 0 : state === 1 ? 1 : state === 6 ? 3 : state >= 7 ? 4 : 2
  const step = state === 0 ? 0 : state === 1 ? 1 : state < 6 ? 2 : state === 6 ? 3 : 4
  return <>
    <div className="oc-demo-heading"><div><p className="oc-demo-eyebrow">INTERVIEW COORDINATION</p><h3>Build the plan. Review it together.</h3></div><Badge variant={state >= 7 ? "success" : "outline"}>{state >= 7 ? "Published" : state >= 2 ? "Draft" : "Round 2"}</Badge></div>
    <div className="oc-demo-panel-steps">{["Availability","Rooms","Proposal","Approval","Schedule"].map((label,index) => <span key={label} data-current={step === index} data-complete={step > index}>{step > index ? <Check size={12} /> : <b>{index + 1}</b>}{label}</span>)}</div>
    <Views active={view}>
      <div><p className="oc-demo-eyebrow">CONFIRMED INTERVIEWER AVAILABILITY</p><div className="oc-demo-availability">{["Alex J.","Sam K.","Naomi R."].map(name => <div key={name}><span className="oc-demo-avatar">{name.split(" ").map(part => part[0]).join("")}</span><div><strong>{name}</strong><p>Thursday · 6:00–8:00 PM</p></div><Badge variant="success">Available</Badge></div>)}</div><Notice>Availability covers the full interview and buffer.</Notice></div>
      <div><div className="oc-demo-room"><MapPin size={20} /><div><h4>Room 204</h4><p>In person · Thursday, October 22</p></div></div><Facts items={[["Interview sessions", "6:00 PM · 6:30 PM"], ["Duration / buffer", "20 minutes / 5 minutes"], ["Interviewers needed", "2 per session"]]} /><Notice>Auto-Fill uses rooms, staffing requirements and confirmed availability.</Notice></div>
      <div><PanelRows state={Math.min(state,5)} /><div className="oc-demo-panel-editor" data-visible={state >= 3} data-demo-entering={state === 3}><p className="oc-demo-eyebrow">EDIT SESSION · 6:30 PM</p><div className="oc-demo-score-row"><span>Replace {state >= 5 ? "Naomi R." : "Sam K."}</span><div className="oc-demo-select-wrap"><button type="button" tabIndex={-1} className="oc-demo-select" data-demo-target="replace-interviewer">{state >= 5 ? "Naomi R." : "Choose replacement"}<ChevronDown size={12} /></button><div className="oc-demo-select-options" data-open={state === 4}><button type="button" tabIndex={-1} data-demo-target="replacement-naomi">Naomi R. · Available</button></div></div></div><p className="oc-demo-small">{state >= 5 ? "Draft updated · Alex J. and Naomi R." : "Check availability before changing an assignment."}</p></div><p className="oc-demo-feedback">4 of 4 staffed · 0 hard conflicts</p><Notice>This is a proposal. Assignments remain unpublished until owner approval.</Notice></div>
      <div className="oc-demo-confirmation"><p className="oc-demo-eyebrow">FINAL PANEL APPROVAL</p><h3>Review the exact plan.</h3><Facts items={[["Club", example.clubMark], ["Rooms / sessions", "1 room / 2 sessions"], ["Required / staffed positions", "4 / 4"], ["Unfilled / hard conflicts", "0 / 0"], ["6:30 PM panel", "Alex J. · Naomi R."]]} /><Notice>A club owner must confirm publication of this exact schedule.</Notice></div>
      <div><PanelRows state={7} /><Notice success>Owner confirmed and published this schedule.</Notice><div className="oc-demo-booking"><Clock3 size={18} /><div><strong>Jordan · Thursday · {sample.time}</strong><p>{example.panel} · Room 204 · Alex J. & Naomi R.</p></div></div></div>
    </Views>
    <div className="oc-demo-actions"><Action target={state === 0 ? "review-rooms" : state === 1 ? "auto-fill" : state < 6 ? "review-publish" : "confirm-publish"} disabled={state >= 7}>{state === 0 ? "Review rooms" : state === 1 ? "Auto-Fill Panels" : state < 6 ? "Review & Publish" : state === 6 ? "Confirm & Publish Panels" : "Schedule published"}{state >= 7 && <Check size={14} />}</Action></div>
  </>
}

function DecideScene() {
  const state = useDemoState()
  return <>
    <Person subtitle={`${example.clubMark} · Final decision`} />
    <div className="oc-demo-evaluation-summary"><div><strong>4.5 / 5</strong><span>Team evaluation</span></div><div><strong>4 reviewers</strong><span>Feedback recorded</span></div></div>
    <Views active={state >= 3 ? 1 : 0}>
      <div><button type="button" tabIndex={-1} className="oc-demo-evaluation-detail" data-demo-target="evaluation-detail">Review recorded evaluations <ChevronDown size={14} /></button><div className="oc-demo-evaluation-notes" data-visible={state >= 1} data-demo-entering={state === 1}><p>Interview note · Jordan explains the evidence before the conclusion.</p><p>Application review · Clear curiosity and thoughtful research.</p></div><div className="oc-demo-decisions">{["Accept","Waitlist","Decline"].map(label => <button type="button" tabIndex={-1} key={label} data-demo-target={label === "Accept" ? "accept-decision" : undefined} aria-pressed={state >= 2 && label === "Accept"}>{label}{state >= 2 && label === "Accept" && <Check size={14} />}</button>)}</div><Notice>Team feedback informs the decision. A leader records the outcome.</Notice></div>
      <div><Notice success>Decision recorded · Accepted</Notice><Facts items={[["Applicant", example.person], ["Decision", "Accepted"], ["Membership offer", "Pending student response"]]} /><p className="oc-demo-small">Membership begins only after Jordan accepts the offer.</p></div>
    </Views>
    <div className="oc-demo-actions"><Action target="record-decision" disabled={state >= 3 || state < 2}>{state >= 3 ? "Decision recorded" : "Record decision"}{state >= 3 && <Check size={14} />}</Action></div>
  </>
}

function ManageScene() {
  const state = useDemoState(), view = Math.min(state, 5)
  return <>
    <Club status="Club workspace" />
    <Tabs labels={["Members","Announcements","Tasks"]} active={state === 0 ? 0 : state < 4 ? 1 : 2} targets={[undefined,"announcements-tab","tasks-tab"]} />
    <Views active={view}>
      <div><div className="oc-demo-heading"><h3>Your member roster</h3><Badge variant="outline">13 members</Badge></div><Person subtitle="New member · Offer accepted" /><Facts items={[["Member status", "Active"], ["Member title", "General member"], ["Joining step", "Jordan accepted the membership offer"]]} /><Notice success>From applicant to member, in the same club workspace.</Notice></div>
      <div><p className="oc-demo-eyebrow">NEW ANNOUNCEMENT</p><label className="oc-demo-field">Title<input readOnly tabIndex={-1} value="Welcome to your next chapter." /></label><label className="oc-demo-field">Message<textarea readOnly tabIndex={-1} value="Join us Thursday at 6 PM for the new member welcome. Your first research brief is ready in Tasks." /></label><Facts items={[["Audience", "Active members"], ["Author", "Alex J."]]} /><Action target="publish-announcement">Publish announcement</Action></div>
      <div className="oc-demo-confirmation"><p className="oc-demo-eyebrow">PUBLISH THIS ANNOUNCEMENT?</p><h3>Welcome to your next chapter.</h3><Facts items={[["Recipients", "Active members"], ["Author", "Alex J."]]} /><Notice>Review the recipients and message before confirming publication.</Notice><Action target="confirm-announcement">Confirm & publish</Action></div>
      <div><p className="oc-demo-eyebrow">ANNOUNCEMENTS</p><div className="oc-demo-welcome-post"><span>PUBLISHED · TO ACTIVE MEMBERS</span><h4>Welcome to your next chapter.</h4><p>Join us Thursday at 6 PM for the new member welcome. Your first research brief is ready in Tasks.</p></div><Notice success>Welcome announcement published to members.</Notice></div>
      <div><div className="oc-demo-heading"><h3>Tasks & submissions</h3><Badge variant="outline">Members</Badge></div><div className="oc-demo-task"><FileText size={18} /><div><h4>Read the welcome brief</h4><p>Jordan Avery · New member</p></div><Badge variant="success">Submitted</Badge></div><div className="oc-demo-task"><Users size={18} /><div><h4>Prepare the welcome agenda</h4><p>Naomi R. · Thursday, 6 PM</p></div><Badge variant="secondary">Assigned</Badge></div><Action target="open-submission" secondary>Open submission</Action></div>
      <div><p className="oc-demo-eyebrow">MEMBER SUBMISSION</p><Person subtitle="Read the welcome brief · Submitted" /><blockquote className="oc-demo-answer">I’ve read the brief and am ready for the first research discussion.</blockquote><Facts items={[["Task", "Read the welcome brief"], ["Assignment", "New member welcome"], ["Status", "Submitted · Ready for review"]]} /><Notice>Read a member’s work alongside the task and assignment.</Notice></div>
    </Views>
  </>
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
