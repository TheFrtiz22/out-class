"use client"
import type { ComponentProps } from "react"
import { PageHeader } from "@/components/product/page-header"
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

type ClubOverviewHeaderProps = Omit<ComponentProps<typeof PageHeader>, "title" | "description"> & {
  clubName: string
  context: Extract<WelcomeContext, { mode: "club" }>
}

/** Club Overview opens with the club's name and the next thing due; greetings stay on personal Home. */
export function ClubOverviewHeader({ clubName, context, className = "", ...props }: ClubOverviewHeaderProps) {
  const now = useWelcomeClock()
  // Local time is read after hydration; until then the line keeps its space without guessing.
  const next = context.data && now ? welcomeSubtitle(context, now) : "\u00a0"
  return <PageHeader {...props} className={`oc-welcome-header ${className}`}
    title={<span className="oc-welcome-text">{clubName}</span>}
    description={<span key={next} className="oc-welcome-text">{next}</span>} />
}
