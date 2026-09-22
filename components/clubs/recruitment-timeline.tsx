"use client"
import { Check } from "lucide-react"
import { recruitmentStage } from "@/lib/club-directory"
import "./club-discovery.css"
export function RecruitmentTimeline({ status }: { status: string }) {
  const current = recruitmentStage(status)
  return (
    <div className="oc-recruitment-timeline">
      <p>
        Your application <strong>{status.replaceAll("_", " ")}</strong>
      </p>
      <ol aria-label="Application recruitment timeline">
        {["Applied", "Review", "Interview", "Decision"].map((label, index) => (
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
