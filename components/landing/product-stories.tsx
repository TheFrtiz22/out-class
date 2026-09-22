"use client"

import * as Tabs from "@radix-ui/react-tabs"
import type { ReactNode } from "react"
import { Check, FileText, ArrowUpRight } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { StatusBadge } from "@/components/status-badge"
import { ClubLogo } from "@/components/club-logo"
import { StickyStory, TextReveal, PreviewReveal } from "@/components/motion/scroll-motion"

function ProductFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <figure className="oc-story-frame">
      <div className="oc-story-toolbar">
        <span>OutClass</span>
        <strong>{title}</strong>
        <span>Preview</span>
      </div>
      <div className="oc-story-interface">{children}</div>
      <figcaption>Illustrative interface · sample information</figcaption>
    </figure>
  )
}
function ProfilePreview() {
  return (
    <ProductFrame title="Your profile">
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
          <dd>Economics</dd>
        </div>
        <div>
          <dt>Experience</dt>
          <dd>Research assistant</dd>
        </div>
      </dl>
      <div className="oc-document-row">
        <FileText aria-hidden="true" size={20} />
        <div>
          <strong>Jordan_Avery_Resume.pdf</strong>
          <span>Part of your shared profile</span>
        </div>
        <Check aria-hidden="true" className="text-success" size={17} />
      </div>
      <div className="oc-story-progress">
        <span>
          Profile completeness <strong>80%</strong>
        </span>
        <Progress value={80} aria-label="Sample profile completeness" />
      </div>
    </ProductFrame>
  )
}
const clubs = [
  {
    id: "180-degrees",
    name: "180 Degrees Consulting",
    logo: "/logos/180-degrees-globe.png",
    category: "Consulting",
    description: "Bring fresh thinking to organizations creating social impact.",
  },
  {
    id: "vvf",
    name: "Virginia Venture Fund",
    logo: "/logos/vvf.webp",
    category: "Finance",
    description: "Explore the people and ideas behind early-stage companies.",
  },
]
function DiscoverPreview() {
  return (
    <ProductFrame title="Discover">
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
      {clubs.map((club) => (
        <div key={club.id} className="oc-discover-row">
          <ClubLogo
            clubId={club.id}
            logoUrl={club.logo}
            text={club.name.slice(0, 2)}
            color="#142d4e"
            size="lg"
          />
          <div>
            <h4>{club.name}</h4>
            <p>{club.description}</p>
            <Badge variant="outline">{club.category}</Badge>
          </div>
        </div>
      ))}
    </ProductFrame>
  )
}
function ApplyPreview() {
  return (
    <ProductFrame title="Application">
      <div className="oc-example-heading">
        <h3>180 Degrees Consulting</h3>
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
        <p>
          I’d like to put research into practice, working with a team to help a local organization
          answer a question that matters.
        </p>
        <span>Club-specific response</span>
      </div>
      <p className="oc-interface-note">Your story is already here. Make this answer your own.</p>
    </ProductFrame>
  )
}
function TrackPreview() {
  return (
    <ProductFrame title="Applications">
      <div className="oc-example-heading">
        <h3>Every next step, together.</h3>
        <span className="oc-interface-note">3 applications</span>
      </div>
      <ul className="oc-track-list">
        {[
          ["Virginia Venture Fund", "Interviewing", "Next step", "Choose an interview time"],
          [
            "180 Degrees Consulting",
            "In Review",
            "Latest update",
            "Your application is under review",
          ],
          ["McIntire Investment Institute", "Drafting", "Next step", "Finish your short response"],
        ].map(([name, status, label, next]) => (
          <li key={name}>
            <div>
              <h4>{name}</h4>
              <StatusBadge status={status} />
            </div>
            <p>
              <span>{label}</span>
              {next}
            </p>
          </li>
        ))}
      </ul>
    </ProductFrame>
  )
}
function LeaderPreview() {
  return (
    <ProductFrame title="Applicants">
      <div className="oc-example-heading">
        <h3>Your next class, taking shape.</h3>
        <Badge variant="outline">Fall recruitment</Badge>
      </div>
      <Tabs.Root defaultValue="applicants">
        <Tabs.List className="oc-leader-example-tabs" aria-label="Example club workspace">
          {[
            ["applicants", "Applicants"],
            ["review", "Review"],
            ["interviews", "Interviews"],
          ].map(([value, label]) => (
            <Tabs.Trigger key={value} value={value}>
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="applicants">
          <div className="oc-leader-table-wrap">
            <table className="oc-leader-table">
              <caption className="sr-only">Example applicant review table</caption>
              <thead>
                <tr>
                  <th scope="col">Applicant</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Score</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Jordan Avery", "In Review", "4.2"],
                  ["Naomi Cho", "Round 1", "4.5"],
                  ["Alex Morgan", "Applied", "—"],
                ].map(([name, status, score]) => (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    <td>
                      <StatusBadge status={status} />
                    </td>
                    <td>{score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="oc-review-note">
            <span>Shared context</span>
            <p>Profiles, responses, and evaluations belong in the same conversation.</p>
          </div>
        </Tabs.Content>
        <Tabs.Content value="review">
          <div className="oc-example-heading">
            <h4>Naomi Cho · Application review</h4>
            <Badge variant="outline">Sample evaluation</Badge>
          </div>
          <div className="oc-review-rubric">
            {[
              ["Motivation & fit", "4.5"],
              ["Problem solving", "4.8"],
              ["Collaboration", "4.3"],
            ].map(([label, score]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{score} / 5</strong>
              </div>
            ))}
          </div>
          <p>
            “A thoughtful response, grounded in experience. Explore the project further during the
            interview.”
          </p>
        </Tabs.Content>
        <Tabs.Content value="interviews">
          <div className="oc-interview-example">
            <div>
              <span>
                <strong>Naomi Cho</strong>
                <small>Round one · 20 minutes</small>
              </span>
              <Badge variant="outline">Scheduled</Badge>
            </div>
            <div>
              <span>
                Tuesday, September 22<small>4:00–4:20 PM · Interview room A</small>
              </span>
              <span>AJ · SK</span>
            </div>
            <p>
              Keep the applicant’s profile, interview notes, and feedback together as the team makes
              its next decision.
            </p>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </ProductFrame>
  )
}

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
            Bring applicants, reviews, and recruitment decisions into one shared workspace.
          </p>
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
