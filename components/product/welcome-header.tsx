"use client"
import type { ComponentProps } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { welcomeGreeting, welcomeSubtitle, type WelcomeContext } from "@/lib/welcome"
import { useWelcomeClock } from "@/hooks/use-welcome-clock"
import "./welcome-header.css"

type WelcomeHeaderProps = Omit<ComponentProps<typeof PageHeader>, "title" | "description"> & {
  firstName?: string | null
  now: Date | null
  context: WelcomeContext
}

export function LocalWelcomeHeader(props: Omit<WelcomeHeaderProps, "now">) {
  const now = useWelcomeClock()
  return <WelcomeHeader {...props} now={now} />
}

export function WelcomeHeader({ firstName, now, context, className = "", ...props }: WelcomeHeaderProps) {
  const title = welcomeGreeting(now, firstName)
  const subtitle = welcomeSubtitle(context, now)
  return <PageHeader {...props} className={`oc-welcome-header ${className}`}
    title={<span key={title} className="oc-welcome-text">{title}</span>}
    description={<span key={subtitle} className="oc-welcome-text">{subtitle}</span>} />
}
