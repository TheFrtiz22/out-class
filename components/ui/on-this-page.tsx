"use client"
import { useEffect, useState, type MouseEvent } from "react"
import { cn } from "@/lib/utils"

export type PageSection = { id: string; title: string }

/**
 * A sticky "On this page" list for long single-page editors. Each link scrolls to its section; the section in
 * view is highlighted (aria-current="location"), re-checked by an IntersectionObserver as sections move. On narrow screens it becomes one
 * horizontally scrolling row of text links. `targetId` maps a section id to its element id.
 */
export function OnThisPage({ sections, targetId = id => id, onJump, label = "On this page", className }: {
  sections: PageSection[]
  targetId?: (id: string) => string
  /** Takes over the jump (open a closed <details>, move focus). Defaults to a smooth scroll. */
  onJump?: (id: string) => void
  label?: string
  className?: string
}) {
  const [active, setActive] = useState(sections[0]?.id ?? "")
  const key = sections.map(section => section.id).join("|")
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return
    const nodes = sections.map(section => document.getElementById(targetId(section.id))).filter((node): node is HTMLElement => !!node)
    // Highlight the last section whose top has passed the reading line (just under the sticky header).
    const pick = () => {
      let current = sections[0]?.id ?? ""
      for (const section of sections) {
        const node = document.getElementById(targetId(section.id))
        if (node && node.getBoundingClientRect().top <= 180) current = section.id
      }
      setActive(current)
    }
    const observer = new IntersectionObserver(pick, { threshold: [0, .25, .5, .75, 1] })
    nodes.forEach(node => observer.observe(node))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the section list is keyed by its ids
  }, [key])
  const jump = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault()
    setActive(id)
    if (onJump) onJump(id)
    else document.getElementById(targetId(id))?.scrollIntoView({ behavior: "smooth", block: "start" })
  }
  return <nav aria-label={label} className={cn("oc-on-this-page", className)} data-slot="on-this-page">
    <p className="oc-on-this-page-label" aria-hidden="true">{label}</p>
    <ul>
      {sections.map(section => <li key={section.id}>
        <a href={`#${targetId(section.id)}`} aria-current={active === section.id ? "location" : undefined} onClick={event => jump(event, section.id)}>{section.title}</a>
      </li>)}
    </ul>
  </nav>
}
