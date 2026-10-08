import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { applicationStatusCode, applicationStatusLabel } from "@/lib/application-status"

const styles: Record<string, string> = {
  Applied: "bg-muted text-muted-foreground border-transparent",
  "In Review": "bg-status-review text-status-review-foreground border-transparent",
  "Round 1": "border-transparent bg-status-interview text-status-interview-foreground before:bg-status-interview-foreground",
  "Round 2": "border-transparent bg-status-interview text-status-interview-foreground before:bg-status-interview-foreground",
  Interviewing: "border-transparent bg-status-interview text-status-interview-foreground before:bg-status-interview-foreground",
  Decision: "bg-accent text-accent-foreground border-transparent",
  Accepted: "bg-status-accepted text-status-accepted-foreground border-transparent",
  Rejected: "bg-status-rejected text-status-rejected-foreground border-transparent",
}

const dotStatuses = new Set(["Round 1", "Round 2", "Interviewing"])

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const code = applicationStatusCode(status)
  const label = applicationStatusLabel(status)
  const styleKey = ({ DRAFTING: "Applied", SUBMITTED: "Applied", IN_REVIEW: "In Review", INTERVIEWING: "Interviewing", ACCEPTED: "Accepted", REJECTED: "Rejected", WAITLISTED: "In Review" } as Record<string, string>)[code] || status
  return (
    <Badge
      data-status-label={label}
      data-status-code={code}
      className={cn(
        "gap-1.5 font-medium",
        dotStatuses.has(styleKey) &&
          "before:size-1.5 before:shrink-0 before:rounded-full before:content-['']",
        styles[styleKey] ?? styles.Applied,
        className,
      )}
      variant="outline"
    >
      {label}
    </Badge>
  )
}
