"use client"

import type { CSSProperties, ReactNode } from "react"
import Image, { getImageProps } from "next/image"
import { CalendarDays, Check, FileText, MessageSquare, Users } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AnimatedCheck, Fill, ProgressiveText, phase, revealAt, useProductProgress } from "./product-motion"
import { journeyExample as example, type JourneyScene } from "./journey-content"

// Each named beat advances one feature story. All scenes rest at progress = 1.
const beats = {
  discover: { filters: .15, finance: .3, primary: .45, category: .55, secondary: .65 },
  profile: { academics: .15, experience: .3, resume: .45, checked: .58, filling: .65, middle: .8, filled: .95 },
  apply: { attached: .15, checked: .24, answer: .3, answered: .65, filling: .65, filled: .8, submitted: .84, confirmed: .92 },
  studentInterview: { event: .2, time: .45, checked: .6, invitation: .75, next: .82, note: .9 },
  status: { firstPath: .15, review: .35, interview: .6, confirmation: .75, secondary: .85, note: .92 },
  join: { member: .3, welcome: .4, checked: .52, welcomeRow: .65, task: .76, conversation: .86 },
  build: { question: .2, required: .32, profile: .4, roundOne: .55, roundTwo: .7, finalRound: .82, note: .94 },
  review: { person: .15, response: .3, rubric: .4, scores: [.45, .55, .65], note: .78 },
  schedule: { event: .15, booking: .35, interviewers: .5, availability: .65, panel: .78, checked: .9 },
  leaderInterview: { event: .15, time: .25, alex: .3, sam: .45, present: .52, question: .55, notes: .7, noted: .9 },
  decide: { options: .15, acceptVotes: [.3, .4, .5, .6], waitlistVote: .48, winner: .65, recorded: .82, checked: .9 },
  manage: { members: .2, added: .34, person: .4, accepted: .5, rows: [.65, .72, .79, .86], note: .94 },
} as const

/** Crossfade changing labels in one reserved cell, including the final accessible text. */
function StateLabel({ steps }: { steps: ReadonlyArray<readonly [number, string]> }) {
  const progress = useProductProgress()
  const active = steps.reduce((selected, [at], index) => progress >= at ? index : selected, 0)
  return <span className="oc-demo-state"><span className="sr-only">{steps[steps.length - 1][1]}</span>{steps.map(([, label], index) =>
    <span key={label} aria-hidden="true" data-current={index === active}>{label}</span>,
  )}</span>
}

function Person({ subtitle, at = 0 }: { subtitle: string; at?: number }) {
  const { props: headshot } = getImageProps({ src: example.headshot, alt: "", width: 48, height: 48 })
  return <div className="oc-profile-person" {...revealAt(useProductProgress(), at)}>
    <Avatar className="size-12"><AvatarImage {...headshot} /><AvatarFallback>{example.initials}</AvatarFallback></Avatar>
    <div><h3>{example.person}</h3><p>{subtitle}</p></div>
  </div>
}

function Club({ status }: { status?: ReactNode }) {
  return <div className="oc-journey-club" {...revealAt(useProductProgress(), 0)}>
    <Image className="oc-sample-club-logo" src={example.clubLogo} alt="" width={48} height={48} />
    <div><h3>{example.club}</h3><p>Fall recruitment</p></div>
    {status && <Badge variant="outline">{status}</Badge>}
  </div>
}

type SceneRow = { label: string; value: ReactNode; at: number }

function Rows({ items }: { items: SceneRow[] }) {
  const progress = useProductProgress()
  return <dl className="oc-journey-rows">{items.map(({ label, value, at }) =>
    <div key={label} {...revealAt(progress, at)}><dt>{label}</dt><dd>{value}</dd></div>,
  )}</dl>
}

function InterviewEvent({ at, timeAt, checkAt, leader = false, applicant = false }: {
  at: number; timeAt: number; checkAt: number; leader?: boolean; applicant?: boolean
}) {
  const progress = useProductProgress()
  return <div className="oc-journey-event" {...revealAt(progress, at)}
    style={{ "--oc-event-line": phase(progress, at, timeAt) } as CSSProperties}>
    <CalendarDays size={24} aria-hidden="true" />
    <div><small>{applicant ? example.person : leader ? "Interview scheduled" : "Your interview"}</small>
      <h4 data-demo-emphasis={progress >= timeAt && progress < checkAt}>{example.interview}</h4>
      <p>{applicant ? "Interview scheduled" : `${example.panel} · ${example.room} · 20 minutes`}</p>
    </div><AnimatedCheck at={checkAt} />
  </div>
}

function DiscoverScene() {
  const progress = useProductProgress()
  const beat = beats.discover
  return <>
    <div className="oc-discover-intro"><h3>Find your kind of curious.</h3><p>Explore clubs by what interests you.</p></div>
    <div className="oc-example-filters" aria-label="Example categories" {...revealAt(progress, beat.filters)}>
      <Badge className="oc-demo-category" data-selected={progress < beat.finance}>All interests</Badge>
      <span className="oc-demo-category" data-selected={progress >= beat.finance}>Finance</span><span>Consulting</span><span>Technology</span>
    </div>
    {[
      { mark: example.clubMark, name: example.club, logo: example.clubLogo, category: "Finance", copy: "Learn to invest with a team that shares your curiosity." },
      { mark: example.consultingClubMark, name: example.consultingClub, logo: example.consultingClubLogo, category: "Consulting", copy: "Bring fresh thinking to organizations creating social impact." },
    ].map((club, index) => <div key={club.mark} className="oc-discover-row" {...revealAt(progress, index === 0 ? beat.primary : beat.secondary)}>
      <Image className="oc-sample-club-logo" src={club.logo} alt="" width={48} height={48} />
      <div><h4>{club.name}</h4><p>{club.copy}</p><Badge variant="outline" {...revealAt(progress, index === 0 ? beat.category : beat.secondary)}>{club.category}</Badge></div>
    </div>)}
  </>
}

function ProfileScene() {
  const progress = useProductProgress()
  const beat = beats.profile
  const completeness = Math.round(40 + 20 * phase(progress, beat.filling, beat.middle) + 20 * phase(progress, beat.middle, beat.filled))
  return <>
    <Person subtitle="University of Virginia · Class of 2029" />
    <dl className="oc-profile-facts"><div><dt>Studying</dt><dd><Fill at={beat.academics}>Economics</Fill></dd></div><div><dt>Experience</dt><dd><Fill at={beat.experience}>Research assistant</Fill></dd></div></dl>
    <div className="oc-document-row" {...revealAt(progress, beat.resume)}><FileText size={20} aria-hidden="true" /><div><strong>Jordan_Avery_Resume.pdf</strong><span>Part of your shared profile</span></div><AnimatedCheck at={beat.checked} /></div>
    <div className="oc-story-progress"><span>Profile completeness <strong>{completeness}%</strong></span><Progress value={completeness} aria-label="Sample profile completeness" /></div>
  </>
}

function ApplyScene() {
  const progress = useProductProgress()
  const beat = beats.apply
  const completion = 40 + 40 * phase(progress, beat.answer, beat.answered) + 20 * phase(progress, beat.filling, beat.filled)
  const submitted = progress >= beat.submitted
  return <>
    <Club status={<StateLabel steps={[[0, "Draft"], [beat.submitted, "Submitted"]]} />} />
    <div className="oc-profile-attached" data-confirmed={progress >= beat.checked} {...revealAt(progress, beat.attached)}><AnimatedCheck at={beat.checked} size={16} /><div><strong>Your profile comes with you</strong><p>Academics, experience, and resume</p></div></div>
    <div className="oc-example-response" {...revealAt(progress, beat.answer)}><h4>What draws you to investing?</h4><p><ProgressiveText start={beat.answer} end={beat.answered} phrases={["I want to turn research", "into a clear recommendation,", "and learn from people", "who challenge how I think."]} /></p><span>Club-specific response</span></div>
    <div className="oc-story-progress" data-submitted={submitted}><span>Application progress <strong><StateLabel steps={[[0, "Draft"], [beat.filled, "Ready"], [beat.submitted, "Submitted"]]} /></strong></span><Progress value={completion} aria-label="Sample application progress" /></div>
    <p className="oc-journey-confirmation" {...revealAt(progress, beat.confirmed)}><AnimatedCheck at={beat.confirmed} size={15} /> Application submitted · In review</p>
  </>
}

function InterviewScene({ leader = false }: { leader?: boolean }) {
  const progress = useProductProgress()
  const beat = leader ? beats.leaderInterview : beats.studentInterview
  return <>
    {leader ? <Person subtitle={`${example.clubMark} · Round 1 interview`} /> : <Club status={<StateLabel steps={[[0, "Invited"], [beats.studentInterview.checked, "Scheduled"]]} />} />}
    <InterviewEvent at={beat.event} timeAt={beat.time} checkAt={leader ? beats.leaderInterview.present : beats.studentInterview.checked} leader={leader} />
    {leader ? <>
      <div className="oc-journey-presence"><span {...revealAt(progress, beats.leaderInterview.alex)}>AJ</span><span {...revealAt(progress, beats.leaderInterview.sam)}>SK</span><p><Fill at={beats.leaderInterview.present}>2 interviewers present</Fill></p></div>
      <div className="oc-interview-question" {...revealAt(progress, beats.leaderInterview.question)}><small>QUESTION BANK · 01</small><h4>How do you turn research into a recommendation?</h4></div>
      <p className="oc-scene-note" {...revealAt(progress, beats.leaderInterview.notes)}><MessageSquare size={14} aria-hidden="true" /> Shared notes · <ProgressiveText start={beats.leaderInterview.notes} end={beats.leaderInterview.noted} phrases={["Jordan explains the evidence", "before the conclusion."]} /></p>
    </> : <>
      <Rows items={[{ label: "Interview invitation", value: "Accepted", at: beats.studentInterview.invitation }, { label: "Next step", value: "Meet your interview panel", at: beats.studentInterview.next }]} />
      <p className="oc-interface-note" {...revealAt(progress, beats.studentInterview.note)}>Your time is confirmed. You’re ready for the conversation.</p>
    </>}
  </>
}

function StatusScene() {
  const progress = useProductProgress()
  const beat = beats.status
  const current = progress >= beat.interview ? 2 : progress >= beat.review ? 1 : 0
  const paths = [0, phase(progress, beat.firstPath, beat.review), phase(progress, beat.review, beat.interview), 0]
  return <>
    <div className="oc-example-heading"><h3>Your applications</h3><Badge variant="outline">2 active</Badge></div>
    <Club status={<StateLabel steps={[[0, "Applied"], [beat.review, "Review"], [beat.interview, "Interview"]]} />} />
    <ol className="oc-journey-stages" aria-label="Sample application stages">{["Applied", "Review", "Interview", "Decision"].map((stage, i) => <li key={stage} data-complete={i < current} aria-current={i === current ? "step" : undefined} style={{ "--oc-stage-path": paths[i] } as CSSProperties}><span aria-hidden="true">{i < current ? <Check size={12} /> : i + 1}</span>{stage}</li>)}</ol>
    <p className="oc-journey-confirmation" {...revealAt(progress, beat.confirmation)}><CalendarDays size={15} aria-hidden="true" /> {example.interview} · Scheduled</p>
    <div className="oc-journey-secondary" {...revealAt(progress, beat.secondary)}><div className="oc-journey-secondary-club"><Image className="oc-sample-club-logo" src={example.consultingClubLogo} alt="" width={48} height={48} /><h4>{example.consultingClub}</h4></div><Badge variant="secondary">In review</Badge></div>
    <p className="oc-interface-note" {...revealAt(progress, beat.note)}>Every update. One place to look.</p>
  </>
}

function JoinScene() {
  const progress = useProductProgress()
  const beat = beats.join
  return <>
    <p className="oc-story-eyebrow">MY CLUBS</p>
    <Club status={<StateLabel steps={[[0, "Accepted"], [beat.member, "Member"]]} />} />
    <div className="oc-journey-welcome" {...revealAt(progress, beat.welcome)}><AnimatedCheck at={beat.checked} size={22} /><div><h3>Welcome to {example.clubMark}.</h3><p>Accepted. Your next chapter starts here.</p></div></div>
    <Rows items={[{ label: "New member welcome", value: "Thursday · 6 PM", at: beat.welcomeRow }, { label: "Your first task", value: "Read the welcome brief", at: beat.task }, { label: "Club conversation", value: "Meet your new team", at: beat.conversation }]} />
  </>
}

function BuildScene() {
  const progress = useProductProgress()
  const beat = beats.build
  return <>
    <Club status="Recruitment setup" />
    <div className="oc-interview-question" {...revealAt(progress, beat.question)}><small>APPLICATION QUESTION · 01</small><h4>What draws you to investing?</h4><p className="oc-interface-note">Short response · <Fill at={beat.required}>Required</Fill></p></div>
    <Rows items={[{ label: "Shared student profile", value: <><AnimatedCheck at={beat.profile} size={14} /> Included</>, at: beat.profile }, { label: "Round 1", value: "Application review", at: beat.roundOne }, { label: "Round 2", value: "Panel interview", at: beat.roundTwo }, { label: "Final round", value: "Team decision", at: beat.finalRound }]} />
    <p className="oc-interface-note" {...revealAt(progress, beat.note)}>Your questions. Your rounds. One clear process.</p>
  </>
}

function ReviewScene() {
  const progress = useProductProgress()
  const beat = beats.review
  return <>
    <div className="oc-example-heading"><h3>Applicant pipeline</h3><Badge variant="secondary">In review</Badge></div>
    <Person subtitle={`Application ready for review · ${example.clubMark}`} at={beat.person} />
    <p className="oc-scene-note" {...revealAt(progress, beat.response)}>“I want to turn research into a clear recommendation…”</p>
    <div className="oc-review-rubric" {...revealAt(progress, beat.rubric)}>{[["Motivation & fit", "4.5"], ["Problem solving", "4.8"], ["Collaboration", "4.3"]].map(([label, score], i) => <div key={label}><span>{label}</span><strong><Fill at={beat.scores[i]}>{score} / 5</Fill></strong></div>)}</div>
    <p className="oc-scene-note" {...revealAt(progress, beat.note)}>Reviewer note · Clear curiosity. Thoughtful research experience.</p>
  </>
}

function ScheduleScene() {
  const progress = useProductProgress()
  const beat = beats.schedule
  return <>
    <div className="oc-example-heading"><h3>Interview schedule</h3><Badge variant="outline">Round 1</Badge></div>
    <InterviewEvent at={beat.event} timeAt={beat.booking} checkAt={beat.checked} applicant />
    <Rows items={[{ label: "Applicant booking", value: "Confirmed", at: beat.booking }, { label: "Interviewers", value: "Alex J. · Sam K.", at: beat.interviewers }, { label: "Availability", value: "Both available", at: beat.availability }, { label: "Panel / room", value: `${example.panel} · ${example.room}`, at: beat.panel }]} />
    <p className="oc-interface-note" {...revealAt(progress, beat.checked)}>The invitation and the team’s calendar agree.</p>
  </>
}

function DecideScene() {
  const progress = useProductProgress()
  const beat = beats.decide
  const votes = [beat.acceptVotes.filter(at => progress >= at).length, progress >= beat.waitlistVote ? 1 : 0, 0]
  return <>
    <Person subtitle={`${example.clubMark} · Final round`} />
    <div className="oc-review-rubric" {...revealAt(progress, beat.options)}>{["Accept", "Waitlist", "Decline"].map((label, i) => <div key={label} data-demo-winner={i === 0 && progress >= beat.winner} data-recorded={progress >= beat.recorded}><span>{label}</span><strong>{votes[i]} {votes[i] === 1 ? "vote" : "votes"}</strong></div>)}</div>
    <p className="oc-scene-note" {...revealAt(progress, beat.winner)}>Round 1 → Interview → Final decision</p>
    <div className="oc-journey-welcome" {...revealAt(progress, beat.recorded)}><AnimatedCheck at={beat.checked} size={22} /><div><h4>Decision recorded</h4><p>{example.person} · Accepted</p></div></div>
  </>
}

function ManageScene() {
  const progress = useProductProgress()
  const beat = beats.manage
  return <>
    <Club status="Club workspace" />
    <div className="oc-journey-member" {...revealAt(progress, beat.members)}><Users size={20} aria-hidden="true" /><div><strong><StateLabel steps={[[0, "12 active members"], [beat.added, "13 active members"]]} /></strong><span {...revealAt(progress, beat.person)}>{example.person} · New member</span></div><Badge variant="secondary" {...revealAt(progress, beat.accepted)}>Accepted</Badge></div>
    <Rows items={[{ label: "Meeting", value: "New member welcome · Thu 6 PM", at: beat.rows[0] }, { label: "Task · Naomi", value: "Prepare welcome agenda", at: beat.rows[1] }, { label: "Task · Alex", value: "Share project briefs", at: beat.rows[2] }, { label: "Communication", value: "Welcome message · Shared", at: beat.rows[3] }]} />
    <p className="oc-interface-note" {...revealAt(progress, beat.note)}>Recruitment ends. Your club keeps going.</p>
  </>
}

export function JourneyScenePreview({ scene }: { scene: JourneyScene }) {
  switch (scene) {
    case "discover": return <DiscoverScene />
    case "profile": return <ProfileScene />
    case "apply": return <ApplyScene />
    case "student-interview": return <InterviewScene />
    case "status": return <StatusScene />
    case "join": return <JoinScene />
    case "build": return <BuildScene />
    case "review": return <ReviewScene />
    case "schedule": return <ScheduleScene />
    case "leader-interview": return <InterviewScene leader />
    case "decide": return <DecideScene />
    case "manage": return <ManageScene />
  }
}
