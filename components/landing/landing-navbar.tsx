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
          <div className="nav-actions">
            <Button variant="outline" size="lg" className="nav-cta" onClick={onSignIn}>
              Sign in
            </Button>
            <Button size="lg" className="oc-nav-primary" onClick={onGetStarted}>
              Get started
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </div>
        </header>
      </div>
    </>
  )
}
