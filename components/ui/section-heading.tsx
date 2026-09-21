import type { ReactNode, ComponentProps } from "react"
import { cn } from "@/lib/utils"

type SectionHeadingProps = Omit<ComponentProps<"div">, "title"> & {
  title: ReactNode
  description?: ReactNode
  eyebrow?: string
  action?: ReactNode
  headingId?: string
  as?: "h1" | "h2" | "h3"
  editorial?: boolean
}

export function SectionHeading({ title, description, eyebrow, action, headingId, as: Heading = "h2", editorial = false, className, ...props }: SectionHeadingProps) {
  return <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)} {...props}>
    <div className="max-w-2xl space-y-3">
      {eyebrow && <p className="text-caption font-medium uppercase tracking-widest text-muted-foreground">{eyebrow}</p>}
      <Heading id={headingId} className={cn("text-title text-foreground", editorial ? "font-display font-normal tracking-tight" : "font-sans font-semibold tracking-tight")}>{title}</Heading>
      {description && <p className="text-body text-muted-foreground">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
}
