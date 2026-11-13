import Image from "next/image"
import { Button } from "@/components/ui/button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { StatusMark, type StatusTone } from "@/components/ui/status-pill"
import { WatchVideoButton } from "./promo-video"
import type { LandingPerspective } from "./journey-content"
import "./hero.css"

/** Approved headline copy, split so one word carries the orange accent (docs/public-site/redesign).
 *  Each audience also gets its own video beside the main action (docs/public-site/videos.md). */
const copy = {
  student: {
    headline: { before: "Find and apply to UVA clubs with ", accent: "one profile.", after: "" },
    support: "Track applications, interviews and decisions in one place.",
    cta: "Create your profile",
    watch: "Watch the video", video: "students",
  },
  leader: {
    headline: { before: "Build your next ", accent: "class.", after: " Bring your club together." },
    support: "Applications, interview panels, decisions and member life, in one workspace for your team.",
    cta: "Set up your club",
    watch: "Watch the pitch", video: "club-pitch",
  },
} as const

const clubTypes = ["Consulting", "Investing", "A cappella", "Dance", "Business fraternities", "Service", "Pre-professional", "Media"] as const

type Tone = "neutral" | "done" | "attention" | "navy"
const toneOf: Record<Tone, StatusTone> = { neutral: "neutral", done: "done", attention: "active", navy: "strong" }
const Chip = ({ tone, children }: { tone: Tone; children: string }) => <StatusMark className="oc-hero-chip" label={children} tone={toneOf[tone]} />

const Avatar = ({ src, size }: { src: string; size: 30 | 34 | 36 | 44 }) =>
  <Image className="oc-hero-avatar" src={src} alt="" width={size} height={size} loading="lazy" />

const leaderColumns = [
  { title: "In review", count: 11, cards: [
    { name: "Jordan Avery", meta: "Third year · Commerce", note: "Rubric 4.3", chip: "2 of 3 reviews", tone: "attention", photo: "/images/landing/jordan-avery.jpg", focus: true },
    { name: "Priya Nair", meta: "Second year · Economics", note: "Rubric 4.0", chip: "1 of 3", tone: "neutral" },
  ] },
  { title: "Interview", count: 6, cards: [
    { name: "Marcus Lee", meta: "First year · Undeclared", note: "Thu 6:30 PM", chip: "Booked", tone: "done" },
    { name: "Sofia Chen", meta: "Second year · CS", note: "Not booked", chip: "Invited", tone: "attention" },
  ] },
  { title: "Decision", count: 3, cards: [
    { name: "Daniel Okafor", meta: "Third year · Finance", note: "Panel 8.5", chip: "Offer", tone: "navy" },
  ] },
] as const

const studentRows = [
  { name: "Jefferson Investment Society", meta: "Interview · Thursday 6:30 PM · Room 204", chip: "Interview", tone: "attention", photo: "/images/landing/jefferson-investment-society.png", focus: true },
  { name: "Grounds Impact Consulting", meta: "Submitted Oct 28 · Round 1 review", chip: "In review", tone: "neutral", photo: "/images/landing/grounds-impact-consulting.png" },
  { name: "Your profile", meta: "Academics, experience and resume, shared with every application", chip: "Complete", tone: "done", photo: "/images/landing/jordan-avery.jpg" },
] as const

const frame = {
  leader: { title: "Jefferson Investment Society", sub: "Applicants · Round 1", photo: "/images/landing/jefferson-investment-society.png",
    updates: [{ who: "Jordan Avery", what: "booked Thu 6:30 PM" }, { label: "Applications this round", value: "24 submitted" }] },
  student: { title: "My applications", sub: "Spring 2027", photo: "/images/landing/jefferson-investment-society.png",
    updates: [{ who: "JIS", what: "invited you to interview" }, { label: "Applications in progress", value: "2 clubs" }] },
} as const

/** A static picture of the product: no demo store, timers or motion. Every value is sample data. */
function ProductFrame({ perspective }: { perspective: LandingPerspective }) {
  const f = frame[perspective]
  const [person, count] = f.updates
  return (
    <figure className="oc-hero-frame-area" aria-label={perspective === "leader" ? "Sample data: a club's applicant pipeline in OutClass" : "Sample data: a student's applications in OutClass"}>
      <p className="oc-hero-update oc-hero-update-person oc-public-glass" aria-hidden="true">
        <Avatar src="/images/landing/jordan-avery.jpg" size={30} />
        <span><strong>{person.who}</strong> {person.what}</span>
      </p>
      <p className="oc-hero-update oc-hero-update-count oc-public-glass-navy" aria-hidden="true">
        <span className="oc-hero-update-label">{count.label}</span>
        <span className="oc-hero-update-value">{count.value}</span>
      </p>
      <div className="oc-hero-frame oc-public-glass-navy">
        <div className="oc-hero-screen">
          <div className="oc-hero-screen-header">
            <Avatar src={f.photo} size={36} />
            <div className="oc-hero-screen-title"><p>{f.title}</p><p>{f.sub}</p></div>
            <span className="oc-hero-sample">Sample data</span>
          </div>
          {perspective === "leader" ? (
            <div className="oc-hero-columns" role="region" aria-label="Sample pipeline columns" tabIndex={0}>
              {leaderColumns.map(column => (
                <div key={column.title} className="oc-hero-column">
                  <p className="oc-hero-column-title">{column.title} · {column.count}</p>
                  {column.cards.map(card => (
                    <div key={card.name} className="oc-hero-card" data-focus={"focus" in card || undefined}>
                      <div className="oc-hero-person">
                        {"photo" in card && <Avatar src={card.photo} size={34} />}
                        <div><p className="oc-hero-name">{card.name}</p><p className="oc-hero-meta">{card.meta}</p></div>
                      </div>
                      <div className="oc-hero-card-foot"><span className="oc-hero-meta">{card.note}</span><Chip tone={card.tone}>{card.chip}</Chip></div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <ul className="oc-hero-list">
              {studentRows.map(row => (
                <li key={row.name} className="oc-hero-card oc-hero-row" data-focus={"focus" in row || undefined}>
                  <Avatar src={row.photo} size={44} />
                  <div className="oc-hero-row-text"><p className="oc-hero-name">{row.name}</p><p className="oc-hero-meta">{row.meta}</p></div>
                  <Chip tone={row.tone}>{row.chip}</Chip>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </figure>
  )
}

export function LandingHero({ perspective, selected = perspective, onPerspectiveChange, onCreateProfile, onLeaderEnter }: {
  perspective: LandingPerspective
  /** The toggle's immediate value; `perspective` (the content) may follow in a transition. */
  selected?: LandingPerspective
  onPerspectiveChange: (perspective: LandingPerspective) => void
  onCreateProfile: () => void
  onLeaderEnter: () => void
}) {
  const text = copy[perspective]
  return (
    <section id="landing-content" tabIndex={-1} className="oc-hero-editorial" aria-labelledby="outclass-hero-title">
      <div className="oc-hero-introduction" data-scroll-indicator-content="">
        <div className="oc-hero-copy">
          <SegmentedControl className="oc-hero-audience-toggle" label="Show OutClass for" value={selected} onChange={onPerspectiveChange}
            options={[{ value: "student", label: "Students" }, { value: "leader", label: "Club leaders" }]} />
          <h1 id="outclass-hero-title" className="oc-hero-headline">
            {text.headline.before}<span className="oc-hero-accent">{text.headline.accent}</span>{text.headline.after}
          </h1>
          <p className="oc-hero-support">{text.support}</p>
          <div className="oc-hero-ctas">
            <Button size="lg" onClick={perspective === "student" ? onCreateProfile : onLeaderEnter}>
              {text.cta}
            </Button>
            <WatchVideoButton video={text.video} label={text.watch} />
          </div>
          <p className="oc-hero-audience">Made for the University of Virginia. Free for students.</p>
        </div>
        <ProductFrame perspective={perspective} />
      </div>
      <ul className="oc-hero-club-types" aria-label="Kinds of clubs on OutClass">
        {clubTypes.map(type => <li key={type}>{type}</li>)}
      </ul>
    </section>
  )
}
