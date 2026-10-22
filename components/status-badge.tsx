import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { applicationStatusCode, applicationStatusLabel } from "@/lib/application-status"

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const code = applicationStatusCode(status)
  const label = applicationStatusLabel(status)
  return (
    <Badge
      data-status-label={label}
      data-status-code={code}
      className={cn("font-medium", className)}
      variant="outline"
    >
      {label}
    </Badge>
  )
}
