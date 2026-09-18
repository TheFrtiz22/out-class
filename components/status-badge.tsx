import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

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
  return (
    <Badge
      className={cn(
        "gap-1.5 font-medium",
        dotStatuses.has(status) &&
          "before:size-1.5 before:shrink-0 before:rounded-full before:content-['']",
        styles[status] ?? styles.Applied,
        className,
      )}
      variant="outline"
    >
      {status}
    </Badge>
  )
}
