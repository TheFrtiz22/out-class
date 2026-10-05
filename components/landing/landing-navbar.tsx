"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight } from "lucide-react"
import { OutClassLogo } from "@/components/outclass-logo"
import { Button } from "@/components/ui/button"

export function LandingNavbar({
  onSignIn,
  onGetStarted,
}: {
  onSignIn: () => void
  onGetStarted: () => void
}) {
  const [scrolled, setScrolled] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting))
    if (sentinel.current) observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [])
  return (
    <>
      <div ref={sentinel} className="oc-nav-sentinel" aria-hidden="true" />
      <div className="oc-nav-shell" data-scrolled={scrolled}>
        <header className="oc-header oc-hero-header">
          <a href="#top" aria-label="OutClass home">
            <OutClassLogo variant={scrolled ? "light" : "dark"} className="h-10 w-auto" />
          </a>
          <nav className="nav-actions" aria-label="Main navigation">
            <Button variant="outline" size="lg" className="nav-cta" asChild>
              <a href="/login" onClick={event => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                event.preventDefault()
                onSignIn()
              }}>Sign in</a>
            </Button>
            <Button size="lg" className="oc-nav-primary" onClick={onGetStarted}>
              Get started
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </nav>
        </header>
      </div>
    </>
  )
}
