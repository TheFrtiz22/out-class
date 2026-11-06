import type { ComponentProps } from "react"
import { applicationDisplay } from "@/lib/application-status"
import { cn } from "@/lib/utils"

/** One compact pill for application states. The text label is always present; tone and dot only reinforce it. */
export function StatusPill({ status, dot = true, className, ...props }: Omit<ComponentProps<"span">, "children"> & { status: string; dot?: boolean }) {
  const { code, state, tone, detail } = applicationDisplay(status)
  return <span data-slot="status-pill" data-tone={tone} data-status-code={code} data-status-state={state} data-dot={dot} className={cn("oc-status-pill", className)} {...props}>
    {state}{detail && <span className="oc-status-pill-detail"> · {detail}</span>}
  </span>
}
