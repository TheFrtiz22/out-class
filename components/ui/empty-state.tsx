"use client"

import { useId, type ReactNode, type ComponentProps } from "react"
import { cn } from "@/lib/utils"

export function EmptyState({ title, description, icon, action, className, ...props }: Omit<ComponentProps<"section">, "title"> & { title: string; description: string; icon?: ReactNode; action?: ReactNode }) {
  const id = useId()
  return <section aria-labelledby={id} className={cn("flex flex-col items-center gap-4 py-section text-center", className)} {...props}>
    {icon && <div aria-hidden="true" className="text-muted-foreground [&_svg]:size-7">{icon}</div>}
    <div className="max-w-sm space-y-2"><h3 id={id} className="text-lg font-semibold">{title}</h3><p className="text-sm leading-relaxed text-muted-foreground">{description}</p></div>
    {action}
  </section>
}
