"use client"

import { useEffect, useRef, type MouseEvent } from "react"
import { ArrowUpRight } from "lucide-react"
import { publicFaqGroups } from "@/lib/public-faq"

function FaqEntry({ id, question, answer }: { id: string; question: string; answer: string }) {
  const details = useRef<HTMLDetailsElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const animation = useRef<Animation | null>(null)
  const destinationOpen = useRef(false)
  useEffect(() => {
    const openFromLink = () => {
      if (window.location.hash !== `#faq-answer-${id}` || !details.current) return
      animation.current?.cancel()
      details.current.open = true
      destinationOpen.current = true
      details.current.scrollIntoView({ block: "start", behavior: "instant" })
      details.current.querySelector("summary")?.focus({ preventScroll: true })
    }
    const frame = requestAnimationFrame(openFromLink)
    window.addEventListener("hashchange", openFromLink)
    return () => { cancelAnimationFrame(frame); window.removeEventListener("hashchange", openFromLink); animation.current?.cancel() }
  }, [id])
  const toggle = (event: MouseEvent<HTMLElement>) => {
    const element = details.current, content = body.current
    if (!element || !content) return
    event.preventDefault()
    const opening = animation.current ? !destinationOpen.current : !element.open
    const height = element.open ? content.getBoundingClientRect().height : 0
    animation.current?.cancel()
    destinationOpen.current = opening
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !content.animate) {
      element.open = opening
      animation.current = null
      return
    }
    element.open = true
    const fullHeight = content.scrollHeight
    const current = content.animate([{ height: `${height}px`, opacity: opening ? .6 : 1 }, { height: `${opening ? fullHeight : 0}px`, opacity: opening ? 1 : .6 }], { duration: 240, easing: "cubic-bezier(.2,.7,.2,1)" })
    animation.current = current
    current.onfinish = () => { element.open = opening; animation.current = null }
  }
  return <details id={`faq-answer-${id}`} ref={details} className="oc-faq-entry">
    <summary onClick={toggle}>{question}<span className="oc-faq-indicator" aria-hidden="true" /></summary>
    <div ref={body} className="oc-faq-answer"><p>{answer}</p><a className="oc-faq-permalink" href={`#faq-answer-${id}`} aria-label={`Link to question: ${question}`}>Link to this answer <ArrowUpRight size={13} aria-hidden="true" /></a></div>
  </details>
}

export function PublicFaq() {
  return <div className="oc-faq-layout">
    <nav className="oc-faq-categories" aria-label="FAQ categories"><span className="oc-public-note">Find your answer</span>{publicFaqGroups.map(group => <a key={group.id} href={`#faq-${group.id}`}>{group.label}<span aria-hidden="true">{String(group.items.length).padStart(2, "0")}</span></a>)}</nav>
    <div className="oc-faq-groups">{publicFaqGroups.map((group, index) => <section key={group.id} id={`faq-${group.id}`} className="oc-faq-group" aria-labelledby={`faq-${group.id}-title`}><h3 id={`faq-${group.id}-title`}><span aria-hidden="true">0{index + 1}</span>{group.label}</h3>{group.items.map(item => <FaqEntry key={item.id} {...item} />)}</section>)}</div>
  </div>
}
