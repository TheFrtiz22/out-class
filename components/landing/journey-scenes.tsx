"use client"

import type { ReactNode } from "react"
import Image from "next/image"
import { CalendarDays, Check, FileText, MessageSquare, Users } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Fill, useProductProgress } from "./product-motion"
import { journeyExample as example, type JourneyScene } from "./journey-content"

function Person({ subtitle }: { subtitle: string }) {
  return <div className="oc-profile-person">
    <Avatar className="size-12"><AvatarImage src={example.headshot} alt="" loading="lazy" /><AvatarFallback>{example.initials}</AvatarFallback></Avatar>
    <div><h3>{example.person}</h3><p>{subtitle}</p></div>
  </div>
}

function Club({ status }: { status?: string }) {
  return <div className="oc-journey-club">
    <Image className="oc-sample-club-logo" src={example.clubLogo} alt="" width={48} height={48} />
    <div><h3>{example.club}</h3><p>Fall recruitment</p></div>
    {status && <Badge variant="outline">{status}</Badge>}
  </div>
}

function Rows({ items }: { items: Array<[string, ReactNode]> }) {
  return <dl className="oc-journey-rows">{items.map(([label, value]) =>
    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>,
  )}</dl>
}

function DiscoverScene() {
  return <>
    <div className="oc-discover-intro"><h3>Find your kind of curious.</h3><p>Explore clubs by what interests you.</p></div>
    <div className="oc-example-filters" aria-label="Example categories"><Badge>All interests</Badge><span>Finance</span><span>Consulting</span><span>Technology</span></div>
    {[
      { mark: example.clubMark, name: example.club, logo: example.clubLogo, category: "Finance", copy: "Learn to invest with a team that shares your curiosity." },
      { mark: example.consultingClubMark, name: example.consultingClub, logo: example.consultingClubLogo, category: "Consulting", copy: "Bring fresh thinking to organizations creating social impact." },
    ].map(club => <div key={club.mark} className="oc-discover-row">
      <Image className="oc-sample-club-logo" src={club.logo} alt="" width={48} height={48} />
      <div><h4>{club.name}</h4><p>{club.copy}</p><Badge variant="outline">{club.category}</Badge></div>
    </div>)}
  </>
}

function ProfileScene() {
  const progress = useProductProgress()
  const completeness = progress < .25 ? 40 : progress < .5 ? 60 : 80
  return <>
    <Person subtitle="University of Virginia · Class of 2029" />
    <dl className="oc-profile-facts"><div><dt>Studying</dt><dd><Fill at={.15}>Economics</Fill></dd></div><div><dt>Experience</dt><dd><Fill at={.3}>Research assistant</Fill></dd></div></dl>
    <div className="oc-document-row"><FileText size={20} aria-hidden="true" /><div><strong><Fill at={.45}>Jordan_Avery_Resume.pdf</Fill></strong><span>Part of your shared profile</span></div><Check size={17} className="text-success" aria-hidden="true" /></div>
    <div className="oc-story-progress"><span>Profile completeness <strong>{completeness}%</strong></span><Progress value={completeness} aria-label="Sample profile completeness" /></div>
  </>
}

function ApplyScene() {
  return <>
    <Club status="Submitted" />
    <div className="oc-profile-attached"><Check size={16} aria-hidden="true" /><div><strong>Your profile comes with you</strong><p>Academics, experience, and resume</p></div></div>
    <div className="oc-example-response"><h4>What draws you to investing?</h4><p>I want to turn research into a clear recommendation, and learn from people who challenge how I think.</p><span>Club-specific response</span></div>
    <div className="oc-story-progress"><span>Application progress <strong>Submitted</strong></span><Progress value={100} aria-label="Sample application progress" /></div>
    <p className="oc-journey-confirmation"><Check size={15} aria-hidden="true" /> Application submitted · In review</p>
  </>
}

function InterviewScene({ leader = false }: { leader?: boolean }) {
  return <>
    {leader ? <Person subtitle={`${example.clubMark} · Round 1 interview`} /> : <Club status="Scheduled" />}
    <div className="oc-journey-event"><CalendarDays size={24} aria-hidden="true" /><div><small>{leader ? "Interview scheduled" : "Your interview"}</small><h4>{example.interview}</h4><p>{example.panel} · {example.room} · 20 minutes</p></div><Check size={17} aria-hidden="true" /></div>
    {leader ? <>
      <div className="oc-journey-presence"><span>AJ</span><span>SK</span><p>2 interviewers present</p></div>
      <div className="oc-interview-question"><small>QUESTION BANK · 01</small><h4>How do you turn research into a recommendation?</h4></div>
      <p className="oc-scene-note"><MessageSquare size={14} aria-hidden="true" /> Shared notes · Jordan explains the evidence before the conclusion.</p>
    </> : <>
      <Rows items={[["Interview invitation", "Accepted"], ["Next step", "Meet your interview panel"]]} />
      <p className="oc-interface-note">Your time is confirmed. You’re ready for the conversation.</p>
    </>}
  </>
}

function StatusScene() {
  return <>
    <div className="oc-example-heading"><h3>Your applications</h3><Badge variant="outline">2 active</Badge></div>
    <Club status="Interview" />
    <ol className="oc-journey-stages" aria-label="Sample application stages">{["Applied", "Review", "Interview", "Decision"].map((stage, i) => <li key={stage} data-complete={i < 3} aria-current={i === 2 ? "step" : undefined}><span aria-hidden="true">{i < 2 ? <Check size={12} /> : i + 1}</span>{stage}</li>)}</ol>
    <p className="oc-journey-confirmation"><CalendarDays size={15} aria-hidden="true" /> {example.interview} · Scheduled</p>
    <div className="oc-journey-secondary"><div className="oc-journey-secondary-club"><Image className="oc-sample-club-logo" src={example.consultingClubLogo} alt="" width={48} height={48} /><h4>{example.consultingClub}</h4></div><Badge variant="secondary">In review</Badge></div>
    <p className="oc-interface-note">Every update. One place to look.</p>
  </>
}

function JoinScene() {
  return <>
    <p className="oc-story-eyebrow">MY CLUBS</p>
    <Club status="Member" />
    <div className="oc-journey-welcome"><Check size={22} aria-hidden="true" /><div><h3>Welcome to {example.clubMark}.</h3><p>Accepted. Your next chapter starts here.</p></div></div>
    <Rows items={[["New member welcome", "Thursday · 6 PM"], ["Your first task", "Read the welcome brief"], ["Club conversation", "Meet your new team"]]} />
  </>
}

function BuildScene() {
  return <>
    <Club status="Recruitment setup" />
    <div className="oc-interview-question"><small>APPLICATION QUESTION · 01</small><h4>What draws you to investing?</h4><p className="oc-interface-note">Short response · Required</p></div>
    <Rows items={[["Shared student profile", <><Check size={14} aria-hidden="true" /> Included</>], ["Round 1", "Application review"], ["Round 2", "Panel interview"], ["Final round", "Team decision"]]} />
    <p className="oc-interface-note">Your questions. Your rounds. One clear process.</p>
  </>
}

function ReviewScene() {
  return <>
    <div className="oc-example-heading"><h3>Applicant pipeline</h3><Badge variant="secondary">In review</Badge></div>
    <Person subtitle={`Application ready for review · ${example.clubMark}`} />
    <p className="oc-scene-note">“I want to turn research into a clear recommendation…”</p>
    <div className="oc-review-rubric">{[["Motivation & fit", "4.5"], ["Problem solving", "4.8"], ["Collaboration", "4.3"]].map(([label, score], i) => <div key={label}><span>{label}</span><strong><Fill at={.15 + i * .15}>{score} / 5</Fill></strong></div>)}</div>
    <p className="oc-scene-note">Reviewer note · Clear curiosity. Thoughtful research experience.</p>
  </>
}

function ScheduleScene() {
  return <>
    <div className="oc-example-heading"><h3>Interview schedule</h3><Badge variant="outline">Round 1</Badge></div>
    <div className="oc-journey-event"><CalendarDays size={24} aria-hidden="true" /><div><small>{example.person}</small><h4>{example.interview}</h4><p>Interview scheduled</p></div><Check size={17} aria-hidden="true" /></div>
    <Rows items={[["Applicant booking", "Confirmed"], ["Interviewers", "Alex J. · Sam K."], ["Availability", "Both available"], ["Panel / room", `${example.panel} · ${example.room}`]]} />
    <p className="oc-interface-note">The invitation and the team’s calendar agree.</p>
  </>
}

function DecideScene() {
  return <>
    <Person subtitle={`${example.clubMark} · Final round`} />
    <div className="oc-review-rubric">{[["Accept", "4 votes"], ["Waitlist", "1 vote"], ["Decline", "0 votes"]].map(([label, votes], i) => <div key={label}><span>{label}</span><strong><Fill at={.15 + i * .15}>{votes}</Fill></strong></div>)}</div>
    <p className="oc-scene-note">Round 1 → Interview → Final decision</p>
    <div className="oc-journey-welcome"><Check size={22} aria-hidden="true" /><div><h4>Decision recorded</h4><p>{example.person} · Accepted</p></div></div>
  </>
}

function ManageScene() {
  return <>
    <Club status="Club workspace" />
    <div className="oc-journey-member"><Users size={20} aria-hidden="true" /><div><strong>13 active members</strong><span>{example.person} · New member</span></div><Badge variant="secondary">Accepted</Badge></div>
    <Rows items={[["Meeting", "New member welcome · Thu 6 PM"], ["Task · Naomi", "Prepare welcome agenda"], ["Task · Alex", "Share project briefs"], ["Communication", "Welcome message · Shared"]]} />
    <p className="oc-interface-note">Recruitment ends. Your club keeps going.</p>
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
