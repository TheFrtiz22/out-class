"use client"

import { useId, type ReactNode, type ComponentProps } from "react"
import { cn } from "@/lib/utils"

export function EmptyState({ title, description, icon, action, className, density = "roomy", align = "center", tone = "plain", ...props }: Omit<ComponentProps<"section">, "title"> & { title: string; description: string; icon?: ReactNode; action?: ReactNode; density?: "compact" | "roomy"; align?: "start" | "center"; tone?: "plain" | "subtle" | "outlined" }) {
  const id = useId()
  return <section data-slot="empty-state" data-density={density} data-align={align} data-tone={tone} aria-labelledby={id} className={cn("oc-empty-state flex flex-col gap-4", className)} {...props}>
    {icon && <div aria-hidden="true" className="text-muted-foreground [&_svg]:size-7">{icon}</div>}
    <div className="max-w-sm space-y-2"><h3 id={id} className="oc-card-heading ">{title}</h3><p className="text-sm leading-relaxed text-muted-foreground">{description}</p></div>
    {action}
  </section>
}
