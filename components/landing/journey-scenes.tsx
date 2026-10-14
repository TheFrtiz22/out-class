"use client"

import { Children, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, FileText, MapPin, Search, ShieldCheck, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useProductPlayback, useProductProgress } from "./product-motion"
import { useJourneyExample } from "./journey-example-state"
import { journeyChapterHref, journeyExample as example, type JourneyScene } from "./journey-content"

const stageAt = (progress: number, points: number[]) => points.filter(point => progress >= point).length

function Club({ status }: { status?: string }) {
  return <div className="oc-demo-club"><Image src={example.clubLogo} alt="" width={40} height={40} /><div><h3>{example.club}</h3><p>Fall recruitment · University of Virginia</p></div>{status && <Badge variant="outline">{status}</Badge>}</div>
}
function Person({ anonymous = false, subtitle = "Economics · Second year" }: { anonymous?: boolean; subtitle?: string }) {
  return <div className="oc-demo-person">{anonymous ? <span className="oc-demo-avatar"><ShieldCheck size={18} aria-hidden="true" /></span> : <Image src={example.headshot} alt="" width={40} height={40} />}<div><h3>{anonymous ? "Applicant 014" : example.person}</h3><p>{anonymous ? "Identity hidden in this configured round" : subtitle}</p></div></div>
}
function Notice({ children, success = false }: { children: ReactNode; success?: boolean }) {
  return <div className="oc-demo-notice" data-success={success}>{success ? <CheckCircle2 size={16} aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}<p>{children}</p></div>
}
function Facts({ items }: { items: [string, ReactNode][] }) {
  return <dl className="oc-demo-facts">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}
function Action({ children, at, disabled = false, secondary = false, onClick }: { children: ReactNode; at?: number; disabled?: boolean; secondary?: boolean; onClick?: () => void }) {
  const { seek } = useProductPlayback()
  return <button type="button" className="oc-demo-button" data-secondary={secondary} disabled={disabled} onClick={() => { onClick?.(); if (at !== undefined) seek(at) }}>{children}</button>
}
function Next({ chapter, children, leader = false }: { chapter: number; children: ReactNode; leader?: boolean }) {
  const search = useSearchParams().toString()
  return <a className="oc-demo-button" href={journeyChapterHref(leader ? "leader" : "student", chapter - 1, search)}>{children}<ArrowRight size={14} aria-hidden="true" /></a>
}
/** Reserve every state in the same cell. Keyboard focus follows a deliberate state change. */
function Views({ active, children }: { active: number; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const focused = document.activeElement as HTMLElement | null
    if (focused && root.current?.contains(focused) && focused.closest('[data-demo-view="false"]')) {
      const view = root.current.querySelector<HTMLElement>('[data-demo-view="true"]')
      const target = view?.querySelector<HTMLElement>('button:not(:disabled), input, textarea, select, a[href]') ?? view
      target?.focus({ preventScroll: true })
    }
  }, [active])
  return <div ref={root} className="oc-demo-views">{Children.toArray(children).map((child, index) => <div key={index} data-demo-view={index === active} inert={index !== active} aria-hidden={index !== active} tabIndex={-1}>{child}</div>)}</div>
}
function Tabs({ labels, active, points }: { labels: string[]; active: number; points: number[] }) {
  const { seek } = useProductPlayback()
  return <div className="oc-demo-tabs" role="group" aria-label="Explore the example workflow">{labels.map((label, index) => <button type="button" key={label} aria-pressed={index === active} onClick={() => seek(points[index])}>{label}</button>)}</div>
}

function DiscoverScene() {
  const progress = useProductProgress()
  const [query, setQuery] = useState<string | null>(null)
  const search = query ?? (progress >= .25 ? "investment" : "")
  const selected = progress >= .65
  const clubs = [{ name: example.club, logo: example.clubLogo, category: "Finance", copy: "Research ideas. Build conviction. Learn together." }, { name: example.consultingClub, logo: example.consultingClubLogo, category: "Consulting", copy: "Fresh thinking for organizations creating social impact." }].filter(club => `${club.name} ${club.category}`.toLowerCase().includes(search.toLowerCase()))
  return <>
    <div className="oc-demo-heading"><div><p className="oc-demo-eyebrow">DISCOVER</p><h3>{selected ? "A club worth getting to know." : "Find your kind of curious."}</h3></div><Badge variant="outline">UVA</Badge></div>
    <Views active={selected ? 1 : 0}>
      <div><label className="oc-demo-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search sample clubs" placeholder="Search clubs or interests" value={search} onChange={event => setQuery(event.target.value)} /></label><div className="oc-demo-filter-line"><span>All interests</span><span>Applications open</span></div><ul className="oc-demo-club-list">{clubs.map(club => <li key={club.name} data-selected={club.name === example.club && progress >= .45}><Image src={club.logo} alt="" width={40} height={40} /><div><h4>{club.name}</h4><p>{club.copy}</p><Badge variant="outline">{club.category}</Badge></div>{club.name === example.club && <Action at={.7}>View club</Action>}</li>)}</ul>{!clubs.length && <p className="oc-demo-empty">No sample clubs match. Try “finance” or “consulting”.</p>}</div>
      <div><Club status="Applications open" /><p className="oc-demo-description">An investment community built around research, discussion, and learning by doing.</p><Facts items={[["Interest", "Finance & investing"], ["Application", "Shared profile + one short response"], ["Recruitment", "Review → Panel interview → Decision"]]} /><Notice>Get to know the organization before you apply.</Notice></div>
    </Views>
    <div className="oc-demo-actions">{selected ? <><Action secondary at={0} onClick={() => setQuery("")}>Back to clubs</Action><Next chapter={2}>Start application</Next></> : <Action at={.7}>Open club profile<ArrowRight size={14} aria-hidden="true" /></Action>}</div>
  </>
}

function ApplyScene() {
  const sample = useJourneyExample()
  const { seek } = useProductPlayback()
  const progress = useProductProgress()
  const step = stageAt(progress, [.6, .9])
  const [answer, setAnswer] = useState<string | null>(null)
  const value = answer ?? (progress >= .25 ? sample.answer : "")
  const ready = !sample.required || value.trim().length > 0
  return <>
    <Club status={step === 2 ? "Submitted" : step === 1 ? "Ready to submit" : "Draft"} />
    <Views active={step}>
      <div><div className="oc-demo-profile-attached"><CheckCircle2 size={18} aria-hidden="true" /><div><strong>Your shared profile is attached</strong><p>Academics · Experience · Resume</p></div></div><label className="oc-demo-field">{sample.question}<textarea aria-label="Sample application response" value={value} placeholder="Your club-specific response" onChange={event => { setAnswer(event.target.value); sample.setAnswer(event.target.value); seek(.3) }} /></label><p className="oc-demo-small">Club-specific question · {sample.required ? "Required" : "Optional"}</p><p className="oc-demo-feedback" data-visible={progress >= .4} aria-hidden={progress < .4}>Draft saved. You can return before submitting.</p></div>
      <div><p className="oc-demo-eyebrow">REVIEW YOUR APPLICATION</p><Person /><Facts items={[["Shared profile", "Attached"], ["Resume", "Jordan_Avery_Resume.pdf"], ["Required response", ready ? "Complete" : "Needs an answer"]]} /><blockquote className="oc-demo-answer">{value}</blockquote><Notice>Review your responses, then submit to this club.</Notice></div>
      <div><div className="oc-demo-success"><CheckCircle2 size={28} aria-hidden="true" /><h3>Application submitted.</h3><p>Your profile and response are together, ready for the club’s review.</p></div><Facts items={[["Applicant", example.person], ["Current status", "Submitted"], ["Next step", "Await club review"]]} /><Notice success>Saved in Your applications. Follow updates in Status.</Notice></div>
    </Views>
    <div className="oc-demo-actions"><Action secondary at={step === 0 ? .45 : .3}>{step === 0 ? "Save draft" : step === 1 ? "Back to responses" : "Replay application"}</Action><Action at={step === 0 ? .65 : 1} disabled={step === 2 || !ready}>{step === 0 ? "Review & submit" : step === 1 ? "Submit application" : "Application submitted"}{step === 2 && <Check size={14} aria-hidden="true" />}</Action></div>
  </>
}

function InterviewScene() {
  const sample = useJourneyExample()
  const progress = useProductProgress()
  const { seek } = useProductPlayback()
  const [selected, setSelected] = useState<string | null>(null)
  const choice = selected ?? (progress >= .4 ? sample.time : null)
  const confirmed = progress >= .85
  return <>
    <Club status={confirmed ? "Scheduled" : "Interview invited"} />
    <Views active={confirmed ? 1 : 0}>
      <div><div className="oc-demo-heading"><div><p className="oc-demo-eyebrow">CHOOSE YOUR INTERVIEW</p><h3>Thursday · October 22</h3></div><CalendarDays size={20} aria-hidden="true" /></div><p className="oc-demo-small">Eastern Time · 20 minute interviews</p><div className="oc-demo-date-strip"><span>Wed<strong>21</strong></span><span data-selected="true">Thu<strong>22</strong></span><span>Fri<strong>23</strong></span></div><div className="oc-demo-times" role="group" aria-label="Sample interview times">{["6:00 PM", "6:30 PM", "7:00 PM"].map(time => <button type="button" key={time} aria-pressed={choice === time} onClick={() => { setSelected(time); seek(.55) }}><strong>{time}</strong><span>{example.room}</span></button>)}</div><Notice>Choose an available time, then confirm your booking.</Notice></div>
      <div><div className="oc-demo-success"><CheckCircle2 size={28} aria-hidden="true" /><h3>Interview confirmed.</h3><p>One less thing to coordinate.</p></div><div className="oc-demo-booking"><CalendarDays size={20} aria-hidden="true" /><div><strong>Thursday · {choice}</strong><p>October 22 · Eastern Time</p></div></div><Facts items={[["Location", example.room], ["Duration", "20 minutes"], ["Next step", "Meet your interview panel"]]} /><Notice success>Your booking and interview details stay together.</Notice></div>
    </Views>
    <div className="oc-demo-actions">{confirmed && <Action secondary at={.2} onClick={() => setSelected(null)}>Try another time</Action>}<Action at={1} disabled={!choice || confirmed} onClick={() => { if (choice) sample.setTime(choice) }}>{confirmed ? "Interview confirmed" : "Confirm interview"}{confirmed && <Check size={14} aria-hidden="true" />}</Action></div>
  </>
}

function StatusScene() {
  const sample = useJourneyExample()
  const progress = useProductProgress()
  const accepted = progress >= .7
  return <>
    <div className="oc-demo-heading"><div><p className="oc-demo-eyebrow">STATUS</p><h3>Your next step, in view.</h3></div><Badge variant="outline">2 applications</Badge></div>
    <Club status={accepted ? "Accepted" : "Interviewing"} />
    <ol className="oc-demo-status-path" aria-label="Sample recruitment progress">{["Submitted", "In review", "Interview", "Decision"].map((label, index) => <li key={label} aria-current={index === (accepted ? 3 : 2) ? "step" : undefined} data-complete={index < (accepted ? 3 : 2)}><span>{index < (accepted ? 3 : 2) ? <Check size={12} aria-hidden="true" /> : index + 1}</span>{label}</li>)}</ol>
    <Views active={accepted ? 1 : 0}>
      <div><div className="oc-demo-booking"><CalendarDays size={20} aria-hidden="true" /><div><strong>Thursday · {sample.time}</strong><p>Confirmed · {example.room} · 20 minutes</p></div></div><Facts items={[["Current round", "Panel interview"], ["Next step", "Attend your interview"]]} /></div>
      <div><Notice success>After final review, the club recorded an acceptance.</Notice><Facts items={[["Decision", "Accepted"], ["Membership offer", "Ready for your response"], ["Next step", "Review and accept your offer"]]} /></div>
    </Views>
    <div className="oc-demo-other-club"><Image src={example.consultingClubLogo} alt="" width={28} height={28} /><span>{example.consultingClub}</span><Badge variant="secondary">In review</Badge></div>
    <div className="oc-demo-actions">{accepted ? <><Action secondary at={0}>See interview status</Action><Next chapter={5}>View your offer</Next></> : <Action at={1}>Preview decision update<ArrowRight size={14} aria-hidden="true" /></Action>}</div>
  </>
}

function JoinScene() {
  const progress = useProductProgress()
  const step = stageAt(progress, [.5, .85])
  return <>
    <Club status={step === 0 ? "Offer pending" : "Member"} />
    <Views active={step}>
      <div><p className="oc-demo-eyebrow">YOUR MEMBERSHIP OFFER</p><h3>There’s a place for you here.</h3><p className="oc-demo-description">{example.club} has accepted your application. Review the offer and choose whether to join.</p><Facts items={[["Decision", "Accepted"], ["Offer", "Awaiting your response"], ["Access after acceptance", "General member"]]} /><Notice>Your decision to accept the offer creates your membership.</Notice></div>
      <div><p className="oc-demo-eyebrow">MY CLUBS</p><Notice success>Offer accepted. Welcome to {example.clubMark}.</Notice><div className="oc-demo-member-card"><Users size={22} aria-hidden="true" /><div><h3>{example.club}</h3><p>General member · Your joined organization</p></div></div><Facts items={[["Next meeting", "New member welcome · Thursday, 6 PM"], ["Your first task", "Read the welcome brief"]]} /></div>
      <div><p className="oc-demo-eyebrow">MEMBER WORKSPACE</p><h3>Your next chapter starts here.</h3><div className="oc-demo-welcome-post"><span>ANNOUNCEMENT · ALEX J.</span><h4>Welcome to the team.</h4><p>Meet your new class at Thursday’s welcome. Read the brief before our first research project.</p></div><Facts items={[["Meeting", "New member welcome · Thursday, 6 PM"], ["Your task", "Read the welcome brief"], ["Access", "General member"]]} /></div>
    </Views>
    <div className="oc-demo-actions">{step > 0 && <Action secondary at={0}>Replay offer example</Action>}<Action at={step === 0 ? .6 : 1} disabled={step === 2}>{step === 0 ? "Accept offer" : step === 1 ? "Open member workspace" : "Member workspace opened"}{step === 2 && <Check size={14} aria-hidden="true" />}</Action></div>
  </>
}

function BuildScene() {
  const { question, setQuestion, required, setRequired } = useJourneyExample()
  const { seek } = useProductPlayback()
  const progress = useProductProgress()
  const setup = progress >= .45
  return <>
    <Club status="Approved workspace" />
    <Tabs labels={["Club profile", "Recruitment setup"]} active={setup ? 1 : 0} points={[0, .55]} />
    <Views active={setup ? 1 : 0}>
      <div><p className="oc-demo-description">An investment community built around research, discussion, and learning by doing.</p><Facts items={[["Club profile", "Finance & investing"], ["Campus", "University of Virginia"], ["Workspace access", "Club owner"]]} /><Notice>Sample club claim approved. Pending claims do not grant access.</Notice></div>
      <div><label className="oc-demo-field">Application question<input aria-label="Sample application question" value={question} onChange={event => { setQuestion(event.target.value); seek(.55) }} /></label><label className="oc-demo-checkbox"><input type="checkbox" checked={required} onChange={event => { setRequired(event.target.checked); seek(.55) }} />Required short response</label><Facts items={[["Shared profile", "Included with every application"], ["Round 1", "Application review"], ["Round 2", "Panel interview"], ["Final round", "Team decision"]]} /><p className="oc-demo-feedback" data-visible={progress >= .9} aria-hidden={progress < .9}>Questions and recruitment rounds saved.</p></div>
    </Views>
    <div className="oc-demo-actions"><Action at={setup ? 1 : .55} disabled={progress === 1 || !question.trim()}>{progress === 1 ? "Setup saved" : setup ? "Save setup" : "Open recruitment setup"}{progress === 1 && <Check size={14} aria-hidden="true" />}</Action>{progress === 1 && <Next leader chapter={2}>See incoming applications</Next>}</div>
  </>
}

function RecruitScene() {
  const sample = useJourneyExample()
  const progress = useProductProgress()
  const pipeline = progress >= .4
  return <>
    <Club status="Recruitment open" />
    <Tabs labels={["Application", "Applicants"]} active={pipeline ? 1 : 0} points={[0, .5]} />
    <Views active={pipeline ? 1 : 0}>
      <div><p className="oc-demo-eyebrow">YOUR APPLICATION</p><div className="oc-demo-question-card"><span>01 · Short response · {sample.required ? "Required" : "Optional"}</span><h4>{sample.question}</h4><p>Shared student profile and resume included.</p></div><div className="oc-demo-rounds"><span>Application review</span><ArrowRight size={14} aria-hidden="true" /><span>Panel interview</span><ArrowRight size={14} aria-hidden="true" /><span>Decision</span></div><Notice>Clear questions and rounds, ready for incoming applications.</Notice></div>
      <div><div className="oc-demo-metrics"><div><strong>22</strong><span>Submitted</span></div><div><strong>12</strong><span>In review</span></div><div><strong>8</strong><span>Interview</span></div><div><strong>2</strong><span>Decided</span></div></div><div className="oc-demo-table" role="table" aria-label="Sample applicant pipeline"><div role="row" className="oc-demo-table-head"><span role="columnheader">Applicant</span><span role="columnheader">Current stage</span></div>{[[example.person, "In review"], ["Maya Patel", "Interview"], ["Noah Williams", "In review"]].map(([name, status]) => <div role="row" key={name} data-selected={name === example.person && progress >= .7}><span role="cell">{name}{name === example.person && <small>Economics · Second year</small>}</span><span role="cell"><Badge variant={status === "Interview" ? "info" : "secondary"}>{status}</Badge></span></div>)}</div><p className="oc-demo-feedback" data-visible={progress >= .7} aria-hidden={progress < .7}>{example.person} selected · Application review</p></div>
    </Views>
    <div className="oc-demo-actions">{progress === 1 ? <Next leader chapter={3}>Review Jordan’s application</Next> : <Action at={pipeline ? 1 : .5}>{pipeline ? "Select Jordan Avery" : "Open applicant pipeline"}<ArrowRight size={14} aria-hidden="true" /></Action>}</div>
  </>
}

function ReviewScene() {
  const sample = useJourneyExample()
  const progress = useProductProgress()
  const [anonymous, setAnonymous] = useState(false)
  const [scores, setScores] = useState([4, 5, 4])
  const [note, setNote] = useState("Clear curiosity. Thoughtful research experience.")
  const { seek } = useProductPlayback()
  const evaluation = progress >= .4
  return <>
    <div className="oc-demo-heading"><p className="oc-demo-eyebrow">APPLICATION REVIEW · ROUND 1</p><Badge variant="outline">{progress >= .85 ? "Evaluated" : "In review"}</Badge></div>
    <Person anonymous={anonymous} />
    <Tabs labels={["Application", "Evaluation"]} active={evaluation ? 1 : 0} points={[0, .5]} />
    <Views active={evaluation ? 1 : 0}>
      <div><label className="oc-demo-checkbox"><input type="checkbox" checked={anonymous} onChange={event => setAnonymous(event.target.checked)} />Show an anonymous-round example</label><blockquote className="oc-demo-answer"><span>{sample.question}</span>{sample.answer}</blockquote><Facts items={[["Shared profile", anonymous ? "Identity hidden" : "Economics · Second year"], ["Club-specific response", "Ready for review"]]} /></div>
      <div><div className="oc-demo-rubric">{["Motivation & fit", "Problem solving", "Collaboration"].map((label, index) => <label key={label}>{label}<select aria-label={`Sample ${label} score`} value={scores[index]} onChange={event => { setScores(current => current.map((score, i) => i === index ? Number(event.target.value) : score)); seek(.5) }}>{[1, 2, 3, 4, 5].map(score => <option key={score} value={score}>{score} / 5</option>)}</select></label>)}</div><label className="oc-demo-field oc-demo-field-compact">Reviewer note<textarea aria-label="Sample reviewer note" value={note} onChange={event => { setNote(event.target.value); seek(.5) }} /></label></div>
    </Views>
    <div className="oc-demo-actions"><p className="oc-demo-feedback" data-visible={progress >= .85} aria-hidden={progress < .85}>Evaluation saved.</p><Action at={evaluation ? 1 : .5} disabled={progress === 1}>{evaluation ? "Save evaluation" : "Evaluate application"}{progress === 1 && <Check size={14} aria-hidden="true" />}</Action></div>
  </>
}

function PanelRows({ published = false }: { published?: boolean }) {
  const sample = useJourneyExample()
  const times = [sample.time === "6:00 PM" ? "6:30 PM" : "6:00 PM", sample.time].sort()
  return <div className="oc-demo-table oc-demo-panel-table" role="table" aria-label={published ? "Published sample panels" : "Proposed sample panels"}><div className="oc-demo-table-head" role="row"><span role="columnheader">Time · Room 204</span><span role="columnheader">Panel assignment</span></div>{times.map(time => <div key={time} role="row"><span role="cell"><strong>{time}</strong><small>{published ? time === sample.time ? example.person : "Noah Williams" : "Thursday · 20 minutes"}</small></span><span role="cell">Alex J. · Sam K.<small>{published ? "Published · 2 assigned" : "Proposed · 2 of 2 staffed"}</small></span></div>)}</div>
}
function LeaderInterviewScene() {
  const sample = useJourneyExample()
  const progress = useProductProgress()
  const step = stageAt(progress, [.18, .4, .65, .9])
  const labels = ["Availability", "Rooms", "Auto-Fill", "Approval", "Schedule"]
  const buttons = ["Review rooms", "Auto-Fill Panels", "Review & Publish", "Confirm & Publish Panels", "Schedule published"]
  const points = [.25, .45, .7, 1, 1]
  return <>
    <div className="oc-demo-heading"><div><p className="oc-demo-eyebrow">INTERVIEW COORDINATION</p><h3>{step === 4 ? "A finalized plan." : "Build the plan. Review it together."}</h3></div><Badge variant={step === 4 ? "success" : "outline"}>{step === 4 ? "Published" : step >= 2 ? "Unpublished draft" : "Round 2"}</Badge></div>
    <div className="oc-demo-panel-steps" aria-label="Panel planning steps">{labels.map((label, index) => <span key={label} data-current={step === index} data-complete={step > index}>{step > index ? <Check size={12} aria-hidden="true" /> : <b>{index + 1}</b>}{label}</span>)}</div>
    <Views active={step}>
      <div><p className="oc-demo-eyebrow">INTERVIEWER AVAILABILITY</p><div className="oc-demo-availability">{["Alex J.", "Sam K."].map(name => <div key={name}><span className="oc-demo-avatar">{name.split(" ").map(part => part[0]).join("")}</span><div><strong>{name}</strong><p>Thursday · 6:00–8:00 PM</p></div><Badge variant="success">Available</Badge></div>)}</div><Notice>Use availability across the full interview and buffer.</Notice></div>
      <div><div className="oc-demo-room"><MapPin size={20} aria-hidden="true" /><div><h4>Room 204</h4><p>In person · Thursday, October 22</p></div></div><Facts items={[["Interview sessions", `${sample.time === "6:00 PM" ? "6:30 PM" : "6:00 PM"} · ${sample.time}`], ["Duration / buffer", "20 minutes / 5 minutes"], ["Interviewers needed", "2 per session"]]} /><Notice>Auto-fill uses your rooms, requirements, and team availability.</Notice></div>
      <div><p className="oc-demo-eyebrow">REVIEW PANEL ASSIGNMENTS</p><PanelRows /><p className="oc-demo-feedback" data-visible={true}>4 of 4 positions staffed · 0 hard conflicts</p><Notice>This is a proposal. Assignments are not official until owner approval.</Notice></div>
      <div><p className="oc-demo-eyebrow">FINAL PANEL APPROVAL</p><h3>Review the exact plan.</h3><Facts items={[["Club", example.clubMark], ["Rooms / sessions", "1 room / 2 sessions"], ["Required / staffed positions", "4 / 4"], ["Unfilled / hard conflicts", "0 / 0"]]} /><Notice>A club owner must select Confirm & Publish Panels.</Notice></div>
      <div><PanelRows published /><Notice success>Owner confirmed and published this schedule.</Notice><div className="oc-demo-booking"><Clock3 size={18} aria-hidden="true" /><div><strong>{example.person} · Thursday · {sample.time}</strong><p>{example.panel} · Room 204 · Alex J. & Sam K.</p></div></div></div>
    </Views>
    <div className="oc-demo-actions">{step === 3 && <Action secondary at={.45}>Return to editing</Action>}{step === 4 && <Action secondary at={0}>Replay panel example</Action>}<Action at={points[step]} disabled={step === 4}>{buttons[step]}{step === 4 && <Check size={14} aria-hidden="true" />}</Action></div>
  </>
}

function DecideScene() {
  const progress = useProductProgress()
  const [decision, setDecision] = useState("Accept")
  const { seek } = useProductPlayback()
  const recorded = progress >= .85
  const outcomes: Record<string, string> = { Accept: "Accepted", Waitlist: "Waitlisted", Decline: "Not accepted" }
  return <>
    <Person subtitle={`${example.clubMark} · Final decision`} />
    <div className="oc-demo-evaluation-summary"><div><strong>4.5 / 5</strong><span>Team evaluation</span></div><div><strong>4 reviewers</strong><span>Feedback recorded</span></div></div>
    <p className="oc-demo-small">Interview note · Jordan explains the evidence before the conclusion.</p>
    <div className="oc-demo-decisions" role="group" aria-label="Sample recruitment decision">{["Accept", "Waitlist", "Decline"].map(label => <button type="button" key={label} aria-pressed={decision === label} disabled={recorded} onClick={() => { setDecision(label); seek(.5) }}>{label}{decision === label && <Check size={14} aria-hidden="true" />}</button>)}</div>
    <Views active={recorded ? 1 : 0}>
      <div><Notice>Team feedback informs the decision. A leader records the outcome.</Notice><Facts items={[["Selected decision", decision], ["Action", "Record decision"]]} /></div>
      <div><Notice success>Decision recorded · {outcomes[decision]}</Notice><Facts items={[["Applicant", example.person], ["Decision", outcomes[decision]], ["Membership offer", decision === "Accept" ? "Pending student response" : "No membership offer"]]} /><p className="oc-demo-small">{decision === "Accept" ? "Membership begins only after Jordan accepts the offer." : "This decision does not create club membership."}</p></div>
    </Views>
    <div className="oc-demo-actions">{recorded && <Action secondary at={.3}>Try another decision</Action>}<Action at={1} disabled={recorded}>{recorded ? "Decision recorded" : "Record decision"}{recorded && <Check size={14} aria-hidden="true" />}</Action></div>
  </>
}

function ManageScene() {
  const progress = useProductProgress()
  const step = stageAt(progress, [.25, .5, .75])
  const [role, setRole] = useState("General member")
  const [review, setReview] = useState(false)
  const [submission, setSubmission] = useState(false)
  return <>
    <Club status="Club workspace" />
    <Tabs labels={["Members", "Access", "Announcements", "Tasks"]} active={step} points={[0, .3, .6, 1]} />
    <Views active={step}>
      <div><div className="oc-demo-heading"><h3>Your member roster</h3><Badge variant="outline">13 members</Badge></div><Person subtitle="New member · Offer accepted" /><Facts items={[["Member status", "Active"], ["Member title", role], ["Joining step", "Jordan accepted the membership offer"]]} /><Notice success>From applicant to member, in the same club workspace.</Notice></div>
      <div><Person subtitle="Member access" /><label className="oc-demo-field">Member title<select aria-label="Sample member title" value={role} onChange={event => setRole(event.target.value)}><option>General member</option><option>Recruitment lead</option><option>Project lead</option></select></label><label className="oc-demo-checkbox"><input type="checkbox" checked={review} onChange={event => setReview(event.target.checked)} />Review applications</label><Notice>{review ? "Sample review capability selected. Save to show the next step." : "Ordinary membership grants no recruitment management permissions."}</Notice></div>
      <div><p className="oc-demo-eyebrow">WELCOME ANNOUNCEMENT</p><div className="oc-demo-welcome-post"><span>TO · ACTIVE MEMBERS</span><h4>Welcome to your next chapter.</h4><p>Join us Thursday at 6 PM for the new member welcome. Your first research brief is ready in Tasks.</p></div><Facts items={[["Audience", "Active members"], ["Author", "Alex J."]]} /><Notice>Announcements and member work live alongside your roster.</Notice></div>
      <div><div className="oc-demo-heading"><h3>Tasks & submissions</h3><Badge variant="outline">Members</Badge></div><div className="oc-demo-task"><FileText size={18} aria-hidden="true" /><div><h4>Read the welcome brief</h4><p>{example.person} · New member</p></div><Badge variant="success">Submitted</Badge></div><div className="oc-demo-task"><Users size={18} aria-hidden="true" /><div><h4>Prepare the welcome agenda</h4><p>Naomi · Thursday, 6 PM</p></div><Badge variant="secondary">Assigned</Badge></div><Action secondary onClick={() => setSubmission(!submission)}>{submission ? "Close sample submission" : "Review sample submission"}</Action>{submission && <p className="oc-demo-submission">Jordan’s submission · “I’ve read the brief and am ready for the first research discussion.”</p>}<p className="oc-demo-feedback" data-visible={true}>Welcome announcement published to members.</p></div>
    </Views>
    <div className="oc-demo-actions">{step < 3 && <Action at={[.3, .6, 1][step]}>{["View member access", "Save member access", "Publish announcement"][step]}<ArrowRight size={14} aria-hidden="true" /></Action>}</div>
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
