"use client"
import { Check } from "lucide-react"
import { recruitmentStage } from "@/lib/club-directory"
import "./club-discovery.css"
export function RecruitmentTimeline({ status, compact = false, rounds, roundId }: { status: string; compact?: boolean; rounds?: {id:string;name:string}[]; roundId?: string }) {
  const labels = rounds?.length ? rounds.map(r=>r.name) : ["Applied", "Review", "Interview", "Decision"]
  const current = rounds?.length ? (/ACCEPTED|REJECTED/.test(status) ? labels.length-1 : rounds.findIndex(r=>r.id===roundId)) : recruitmentStage(status)
  const label = status === status.toUpperCase()
    ? status.replaceAll("_", " ").toLowerCase().replace(/^./, character => character.toUpperCase())
    : status
  return (
    <div className={`oc-recruitment-timeline${compact ? " oc-recruitment-timeline-compact" : ""}`}>
      {!compact && <p>
        Your application <strong>{label}</strong>
      </p>}
      <ol aria-label="Application recruitment timeline">
        {labels.map((label, index) => (
          <li
            key={label}
            aria-current={index === current ? "step" : undefined}
            data-complete={index < current}
          >
            <span aria-hidden="true">{index < current ? <Check size={13} /> : index + 1}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>
      {current < 0 && (
        <small>
          {/draft/i.test(status)
            ? "Your draft hasn’t been submitted yet."
            : "The club is using a custom stage. See your application for details."}
        </small>
      )}
    </div>
  )
}
