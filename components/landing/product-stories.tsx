"use client"

import { useState } from "react"
import { ProductMotion, Fill, useProductProgress } from "./product-motion"
import type { ReactNode } from "react"
import { Check, FileText, ArrowUpRight } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { StatusBadge } from "@/components/status-badge"
import { StickyStory, TextReveal, PreviewReveal } from "@/components/motion/scroll-motion"

function ProductFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ProductMotion duration={title === "Club workspace" ? 32000 : 14000}><figure className="oc-story-frame">
      <div className="oc-story-toolbar">
        <span>OutClass</span>
        <strong>{title}</strong>
        <span>Preview</span>
      </div>
      <div className="oc-story-interface">{children}</div>
      <figcaption>Illustrative interface · sample information</figcaption>
    </figure></ProductMotion>
  )
}
function ProfileContent() {
  const progress = useProductProgress()
  return (
    <>
      <div className="oc-profile-person">
        <Avatar className="size-12">
          <AvatarFallback>JA</AvatarFallback>
        </Avatar>
        <div>
          <h3>Jordan Avery</h3>
          <p>University of Virginia · Class of 2029</p>
        </div>
      </div>
      <p className="oc-profile-bio">
        Curious about the ideas that turn a small business into something lasting.
      </p>
      <dl className="oc-profile-facts">
        <div>
          <dt>Studying</dt>
          <dd><Fill at={.15}>Economics</Fill></dd>
        </div>
        <div>
          <dt>Experience</dt>
          <dd><Fill at={.3}>Research assistant</Fill></dd>
        </div>
      </dl>
      <div className="oc-document-row">
        <FileText aria-hidden="true" size={20} />
        <div>
          <strong><Fill at={.48}>Jordan_Avery_Resume.pdf</Fill></strong>
          <span>Part of your shared profile</span>
        </div>
        <Check aria-hidden="true" className="text-success" size={17} />
      </div>
      <div className="oc-story-progress">
        <span>
          Profile completeness <strong>{progress < .15 ? 20 : progress < .3 ? 40 : progress < .48 ? 60 : 80}%</strong>
        </span>
        <Progress value={progress < .15 ? 20 : progress < .3 ? 40 : progress < .48 ? 60 : 80} aria-label="Sample profile completeness" />
      </div>
    </>
  )
}
function ProfilePreview() { return <ProductFrame title="Your profile"><ProfileContent /></ProductFrame> }
const clubs = [
  {
    id: "sample-impact",
    name: "Impact Consulting · sample",
    logo: undefined,
    category: "Consulting",
    description: "Bring fresh thinking to organizations creating social impact.",
  },
  {
    id: "sample-venture",
    name: "Venture Collective · sample",
    logo: undefined,
    category: "Finance",
    description: "Explore the people and ideas behind early-stage companies.",
  },
]
function DiscoverContent() {
  const progress = useProductProgress()
  return (
    <>
      <div className="oc-discover-intro">
        <h3>Find your kind of curious.</h3>
        <p>Explore clubs by what interests you.</p>
      </div>
      <div className="oc-example-filters" aria-label="Example categories">
        <Badge>All interests</Badge>
        <span>Consulting</span>
        <span>Finance</span>
        <span>Technology</span>
      </div>
      <div className="oc-discover-window"><div style={{ transform: `translateY(-${Math.min(1, progress * 1.5) * 108}px)` }} className="oc-discover-scroll">{[...clubs, { id: "sample-design", name: "Design Collective · sample", logo: undefined, category: "Design", description: "Make useful things with a thoughtful team." }].map((club) => (
        <div key={club.id} className="oc-discover-row">
          <span className="oc-sample-monogram" aria-hidden="true">{club.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <h4>{club.name}</h4>
            <p>{club.description}</p>
            <Badge variant="outline">{club.category}</Badge>
          </div>
        </div>
      ))}</div></div>
    </>
  )
}
function DiscoverPreview() { return <ProductFrame title="Discover"><DiscoverContent /></ProductFrame> }
function Essay() {
  const progress = useProductProgress()
  const text = "I’d like to put research into practice, working with a team to help a local organization answer a question that matters."
  const count = Math.floor(Math.min(1, progress * 1.5) * text.length)
  return <p className="oc-essay"><span className="sr-only">{text}</span><span aria-hidden="true">{text.slice(0, count)}<span style={{ opacity: 0 }}>{text.slice(count)}</span></span></p>
}
function ApplyPreview() {
  return (
    <ProductFrame title="Application">
      <div className="oc-example-heading">
        <h3>Impact Consulting · sample</h3>
        <Badge variant="outline">Draft</Badge>
      </div>
      <div className="oc-profile-attached">
        <Check aria-hidden="true" size={16} />
        <div>
          <strong>Your profile comes with you</strong>
          <p>Academics, experience, and resume</p>
        </div>
      </div>
      <div className="oc-example-response">
        <h4>What draws you to impact consulting?</h4>
        <Essay />
        <span>Club-specific response</span>
      </div>
      <p className="oc-interface-note">Your story is already here. Make this answer your own.</p>
    </ProductFrame>
  )
}
function TrackContent() {
  const progress = useProductProgress()
  const stages = ["Applied", "In Review", "Round 1", "Interviewing", "Accepted"]
  return <><div className="oc-example-heading"><h3>Every next step, together.</h3><span className="oc-interface-note">3 sample applications</span></div>
    <ul className="oc-track-list">{["Venture Collective", "Impact Consulting", "Design Collective"].map((name, index) => {
      const step = Math.min(4, Math.max(0, Math.floor(progress * (6 - index) - index * .4)))
      const status = index === 1 && step === 4 ? "Rejected" : stages[step]
      return <li key={name}><div><h4>{name}</h4><StatusBadge status={status} /></div><p><span>Application journey</span>Applied → Review → Round 1 → Interview → Decision</p></li>
    })}</ul></>
}
function TrackPreview() { return <ProductFrame title="Applications"><TrackContent /></ProductFrame> }

const leaderChapters = ["Review Applications", "Interviews", "Voting & Decisions", "Club Management"]
function LeaderContent() {
  const progress = useProductProgress()
  const [selected, setSelected] = useState<number | null>(null)
  const chapter = selected ?? Math.min(3, Math.floor(progress * 4))
  const phase = selected !== null || progress === 1 ? 1 : (progress * 4) % 1
  return <>
    <div className="oc-leader-chapters" aria-label="Product walkthrough chapters">{leaderChapters.map((label, index) => <button type="button" key={label} aria-pressed={chapter === index} onClick={() => setSelected(index)}>{label}</button>)}</div>
    <div className="oc-leader-scene">
      <p className="oc-story-eyebrow">{String(chapter + 1).padStart(2, "0")} / 04 · {leaderChapters[chapter]}</p>
      {chapter === 0 && <><h3>Jordan Avery · Application review</h3><p className="oc-scene-note">“I helped our research team turn interviews into a clear recommendation.”</p><div className="oc-review-rubric">{["Motivation & fit", "Problem solving", "Collaboration"].map((label, i) => <div key={label}><span>{label}</span><strong>{phase > .15 + i * .18 ? ["4.5", "4.8", "4.3"][i] + " / 5" : "—"}</strong></div>)}</div><p className="oc-scene-note">{phase > .75 ? "Evaluation saved · ready for the team’s review" : "Read the response. Score against a shared rubric."}</p></>}
      {chapter === 1 && <><h3>A conversation with context.</h3><p className="oc-scene-note">Jordan Avery · Round 1 · 20 minutes</p><div className="oc-interview-question"><small>QUESTION {phase < .5 ? "1" : "2"} OF 2</small><h4>{phase < .5 ? "Tell us about a time your team disagreed." : "How did you decide what to recommend?"}</h4></div><p className="oc-scene-note">Interviewer notes</p><p>{phase < .25 ? "Listening to the applicant…" : phase < .65 ? "Invited different perspectives before proposing a next step." : "Compared the evidence, explained tradeoffs, and checked the recommendation with the team."}</p></>}
      {chapter === 2 && <><h3>Make the next decision together.</h3><p className="oc-scene-note">Jordan Avery · Final deliberation</p><div className="oc-review-rubric">{["Accept", "Waitlist", "Decline"].map((label, i) => <div key={label}><span>{label}</span><strong>{phase < .3 ? "—" : [phase < .6 ? "2 votes" : "4 votes", "1 vote", "0 votes"][i]}</strong></div>)}</div><p className="oc-scene-note">{phase > .75 ? "Decision recorded: Accepted · notification pending" : "Collect the team’s votes before recording a decision."}</p></>}
      {chapter === 3 && <><h3>Keep the momentum going.</h3><p className="oc-scene-note">Your club, beyond recruitment</p><div className="oc-review-rubric"><div><span>Meeting · New member welcome</span><strong>Thu · 6 PM</strong></div><div><span>{phase > .35 ? "✓" : "○"} Prepare welcome agenda</span><strong>Naomi</strong></div><div><span>{phase > .7 ? "✓" : "○"} Share project briefs</span><strong>Alex</strong></div><div><span>Members</span><strong>{phase > .5 ? "13 · Jordan added" : "12 active"}</strong></div></div></>}
    </div>
  </>
}
function LeaderPreview() { return <ProductFrame title="Club workspace"><LeaderContent /></ProductFrame> }

const stories = [
  {
    id: "students",
    number: "01",
    context: "Build one profile",
    title: "Start with your story.",
    description:
      "Your academics, experience, and resume. A thoughtful introduction you can bring to each club.",
    preview: <ProfilePreview />,
  },
  {
    id: "discover-clubs",
    number: "02",
    context: "Discover selective clubs",
    title: "Find the people who get you.",
    description:
      "Explore what clubs do and what they care about. Find a place for your interests to grow.",
    preview: <DiscoverPreview />,
  },
  {
    id: "apply",
    number: "03",
    context: "Apply without starting over",
    title: "Less repetition. More you.",
    description:
      "Bring your shared profile, then focus on the questions that make each club different.",
    preview: <ApplyPreview />,
  },
  {
    id: "track",
    number: "04",
    context: "Track every application",
    title: "Know your next step.",
    description:
      "Drafts, updates, and interview invitations in one place. Pick up exactly where you left off.",
    preview: <TrackPreview />,
  },
]
export function ProductStories({ onLeaderEnter }: { onLeaderEnter: () => void }) {
  return (
    <div className="oc-product-stories">
      <p className="oc-story-intro">From your first introduction to your next interview.</p>
      {stories.map((story) => (
        <StickyStory
          key={story.id}
          id={story.id}
          className="oc-product-story"
          aria-labelledby={`${story.id}-title`}
        >
          <div className="oc-story-copy">
            <p data-motion="context" className="oc-story-eyebrow">
              <span>{story.number}</span>
              {story.context}
            </p>
            <TextReveal asChild>
              <h2 id={`${story.id}-title`}>{story.title}</h2>
            </TextReveal>
            <p data-motion="body">{story.description}</p>
          </div>
          <PreviewReveal className="oc-story-visual">{story.preview}</PreviewReveal>
        </StickyStory>
      ))}
      <StickyStory
        id="clubs"
        className="oc-product-story oc-leader-story"
        aria-labelledby="clubs-title"
      >
        <div className="oc-story-copy">
          <p data-motion="context" className="oc-story-eyebrow">
            <span>05</span>For club leaders
          </p>
          <TextReveal asChild>
            <h2 id="clubs-title">A clearer view of your next class.</h2>
          </TextReveal>
          <p data-motion="body">
            Review applications, lead interviews, vote on decisions, and manage your club in one shared workspace.
          </p>
          <p className="oc-leader-summary">Review Applications · Interviews<br />Voting &amp; Decisions · Club Management</p>
          <button type="button" className="oc-story-link" onClick={onLeaderEnter}>
            Explore the club workspace
            <ArrowUpRight aria-hidden="true" size={16} />
          </button>
        </div>
        <PreviewReveal className="oc-story-visual">
          <LeaderPreview />
        </PreviewReveal>
      </StickyStory>
    </div>
  )
}
