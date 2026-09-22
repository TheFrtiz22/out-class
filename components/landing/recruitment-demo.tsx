"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { Check, FileText, MessageSquare, Pause, Play, RotateCcw, CalendarDays } from "lucide-react"
import { OutClassLogo } from "@/components/outclass-logo"
import {
  demoApplicants,
  applicantStage,
  stageColumn,
  DEMO_TICKS,
  type DemoStage,
} from "./recruitment-demo-data"
import "./recruitment-demo.css"

function ReviewerVotes({ voting, votes }: { voting: boolean; votes: number }) {
  return (
    <div className="oc-demo-reviewers">
      <span>AJ</span>
      <span>SK</span>
      <span>MT</span>
      <small>{voting ? ["✓", "✓", "—", "✓"].slice(0, votes).join("  ") : "3 reviewers"}</small>
    </div>
  )
}

function ApplicantCard({
  applicant,
  stage,
  tick,
  row,
}: {
  applicant: (typeof demoApplicants)[number]
  stage: DemoStage
  tick: number
  row: number
}) {
  const column = stageColumn(stage)
  const progress = stage === "Created" ? 12 : Math.min(100, 50 + (tick - applicant.offset - 1) * 50)
  return (
    <div
      className="oc-demo-applicant"
      data-stage={stage}
      style={
        {
          "--column": column,
          "--row": row,
          opacity: tick < applicant.offset ? 0 : 1,
        } as CSSProperties
      }
    >
      <div className="oc-demo-person">
        <span className="oc-demo-avatar">{applicant.initials}</span>
        <div>
          <strong>{applicant.name}</strong>
          <small>{applicant.subject}</small>
        </div>
      </div>
      <div className="oc-demo-status">
        <span>
          {stage === "Accepted" && <Check size={12} />}
          {stage}
        </span>
        {column === 1 && stage !== "Review" && (
          <strong>
            {applicant.score}
            <small> / 5</small>
          </strong>
        )}
      </div>
      <div className="oc-demo-detail">
        {column === 0 ? (
          <>
            <div className="oc-demo-progress">
              <span style={{ transform: `scaleX(${progress / 100})` }} />
            </div>
            <small>
              <FileText size={11} />
              {stage === "Created"
                ? "Profile connected"
                : stage === "In progress"
                  ? progress < 70
                    ? "Resume attached"
                    : "Responses completed"
                  : "Application received"}
            </small>
          </>
        ) : column === 1 ? (
          <>
            <ReviewerVotes
              voting={stage === "Voting"}
              votes={Math.min(4, tick - applicant.offset - 6)}
            />
            <small>
              <MessageSquare size={11} />
              {stage === "Review"
                ? "Reading profile & responses"
                : stage === "Team scoring"
                  ? "Rubric completed · 2 notes"
                  : "Team votes recorded"}
            </small>
          </>
        ) : column === 2 ? (
          <>
            <small>
              <CalendarDays size={12} />
              {stage === "Interview" ? "Round one · 20 minutes" : "Interview feedback shared"}
            </small>
            <small>
              {stage === "Interview" ? "Meet your next team" : "Final recommendation ready"}
            </small>
          </>
        ) : (
          <>
            <small>
              {stage === "Accepted"
                ? "Welcome to your next chapter."
                : "Thank you for your interest."}
            </small>
            <small>Decision shared with applicant</small>
          </>
        )}
      </div>
    </div>
  )
}

export function RecruitmentDemo() {
  // A useful final snapshot is also the server/no-JS and reduced-motion state.
  const [tick, setTick] = useState(35)
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(true)
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)")
    const motion = () => {
      setReduced(query.matches)
      setTick(query.matches ? 35 : 0)
    }
    motion()
    query.addEventListener("change", motion)
    let intersecting = false
    const visibility = () => setVisible(intersecting && !document.hidden)
    const observer = new IntersectionObserver(
      ([entry]) => {
        intersecting = entry.isIntersecting
        visibility()
      },
      { threshold: 0.15 },
    )
    if (ref.current) observer.observe(ref.current)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      observer.disconnect()
      query.removeEventListener("change", motion)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [])
  useEffect(() => {
    if (paused || reduced || !visible) return
    const timer = setInterval(() => setTick((value) => (value + 1) % DEMO_TICKS), 500)
    return () => clearInterval(timer)
  }, [paused, reduced, visible])
  const rows = [0, 0, 0, 0]
  const applicants = demoApplicants.map((applicant) => {
    const stage = applicantStage(tick, applicant)
    return { applicant, stage, row: tick < applicant.offset ? 0 : rows[stageColumn(stage)]++ }
  })
  return (
    <figure ref={ref} className="oc-recruitment-demo" aria-labelledby="recruitment-demo-title">
      <div className="oc-demo-browser">
        <div aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <span>outclass · recruitment workspace</span>
        <span className="oc-demo-sample">Fictional demo</span>
      </div>
      <div className="oc-demo-toolbar">
        <OutClassLogo className="h-7 w-auto" />
        <span>Recruitment / Fall semester</span>
        <span className="oc-demo-team">Club workspace</span>
      </div>
      <div className="oc-demo-heading">
        <div>
          <p>GOOD PEOPLE. A CLEARER PROCESS.</p>
          <h2 id="recruitment-demo-title">Your next class, taking shape.</h2>
        </div>
        <span>
          6 applicants <span aria-hidden="true">·</span> One shared workspace
        </span>
      </div>
      <p className="sr-only">
        Illustrative recruitment cycle: students build a profile, complete and submit an
        application. Club reviewers score responses and vote. Selected applicants interview and
        receive a final decision. This demonstration ends with four accepted applicants and two not
        advanced.
      </p>
      <div className="oc-demo-board" aria-hidden="true" data-reset={tick >= 39}>
        <div className="oc-demo-columns">
          {["Applications", "Review & vote", "Interviews", "Decisions"].map((label, index) => (
            <div key={label}>
              <span className={`oc-demo-column-dot oc-demo-dot-${index}`} />
              {label}
              <small>{rows[index]}</small>
            </div>
          ))}
        </div>
        <div className="oc-demo-cards">
          {applicants.map(({ applicant, stage, row }) => (
            <ApplicantCard
              key={applicant.name}
              applicant={applicant}
              stage={stage}
              tick={tick}
              row={row}
            />
          ))}
        </div>
      </div>
      <figcaption>
        <span>
          <span className="oc-demo-live-dot" />
          {reduced
            ? "Recruitment, from first draft to final decision"
            : "A recruitment cycle in 20 seconds"}
        </span>
        <div>
          {!reduced && (
            <>
              <button
                type="button"
                aria-label={paused ? "Play recruitment demo" : "Pause recruitment demo"}
                aria-pressed={paused}
                onClick={() => setPaused((value) => !value)}
              >
                {paused ? <Play size={13} /> : <Pause size={13} />}
                {paused ? "Play" : "Pause"}
              </button>
              <button
                type="button"
                aria-label="Replay recruitment demo"
                onClick={() => {
                  setTick(0)
                  setPaused(false)
                }}
              >
                <RotateCcw size={13} />
                Replay
              </button>
            </>
          )}
        </div>
      </figcaption>
    </figure>
  )
}
