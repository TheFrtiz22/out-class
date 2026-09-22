"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, Menu, X } from "lucide-react"
import { OutClassLogo } from "@/components/outclass-logo"
import { Button } from "@/components/ui/button"

export function LandingNavbar({
  onSignIn,
  onCreateProfile,
}: {
  onSignIn: () => void
  onCreateProfile: () => void
}) {
  const [menu, setMenu] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting))
    if (sentinel.current) observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [])
  return (
    <>
      <div ref={sentinel} className="oc-nav-sentinel" aria-hidden="true" />
      <div className="oc-nav-shell" data-scrolled={scrolled || menu}>
        <header
          className="oc-header oc-hero-header"
          onKeyDown={(event) => {
            if (event.key === "Escape" && menu) {
              setMenu(false)
              toggle.current?.focus()
            }
          }}
        >
          <a href="#top" aria-label="OutClass home">
            <OutClassLogo className="h-10 w-auto" />
          </a>
          <nav id="public-navigation" aria-label="Public navigation" className={menu ? "open" : ""}>
            {[
              ["#students", "For students"],
              ["#clubs", "For clubs"],
              ["#about", "About"],
            ].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenu(false)}>
                {label}
              </a>
            ))}
          </nav>
          <div className="nav-actions">
            <button type="button" className="nav-cta" onClick={onSignIn}>
              Sign in
            </button>
            <Button className="oc-nav-primary" onClick={onCreateProfile}>
              Get started
              <ArrowRight size={14} aria-hidden="true" />
            </Button>
            <button
              ref={toggle}
              type="button"
              className="mobile-menu"
              aria-label={menu ? "Close navigation" : "Open navigation"}
              aria-expanded={menu}
              aria-controls="public-navigation"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </header>
      </div>
    </>
  )
}
