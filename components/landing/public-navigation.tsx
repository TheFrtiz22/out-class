"use client"

import { useEffect, useId, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { OutClassLogo } from "@/components/outclass-logo"
import { Button } from "@/components/ui/button"
import { RollingNavigationLabel } from "./rolling-navigation-label"
import "./public-navigation.css"

const links = [
  { label: "How It Works", href: "/#about" },
  { label: "About OutClass", href: "/about" },
  { label: "FAQ", href: "/uva#faq" },
  { label: "Request Your School", href: "/request-school" },
] as const

/** Shared marketing header. Account workspaces keep their own navigation. */
export function PublicNavigation({ hero = false }: {
  hero?: boolean
}) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [hash, setHash] = useState("")
  const toggle = useRef<HTMLButtonElement>(null)
  const header = useRef<HTMLElement>(null)
  const mobileMenuId = useId()
  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 32)
    const updateHash = () => { setHash(window.location.hash); setOpen(false) }
    updateScroll()
    updateHash()
    window.addEventListener("scroll", updateScroll, { passive: true })
    window.addEventListener("hashchange", updateHash)
    return () => { window.removeEventListener("scroll", updateScroll); window.removeEventListener("hashchange", updateHash) }
  }, [])
  useEffect(() => {
    if (!open) return
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggle.current?.focus() }
    }
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(false)
    }
    const desktop = window.matchMedia("(min-width: 1100px)")
    const closeOnDesktop = () => {
      if (!desktop.matches) return
      // A hidden toggle/menu must not retain keyboard focus after resizing.
      if (document.activeElement === toggle.current || header.current?.querySelector(".oc-public-mobile")?.contains(document.activeElement)) {
        header.current?.querySelector<HTMLAnchorElement>(".oc-public-logo")?.focus()
      }
      setOpen(false)
    }
    document.addEventListener("keydown", dismiss)
    document.addEventListener("pointerdown", outside)
    desktop.addEventListener("change", closeOnDesktop)
    return () => {
      document.removeEventListener("keydown", dismiss)
      document.removeEventListener("pointerdown", outside)
      desktop.removeEventListener("change", closeOnDesktop)
    }
  }, [open])
  const active = (href: string) => {
    const [path, anchor] = href.split("#")
    if (pathname === "/uva" && anchor === "faq") return hash === "#faq" || hash.startsWith("#faq-")
    if (pathname === "/" && anchor === "about") return ["#about", "#students", "#club-leaders", "#clubs"].includes(hash) || hash.startsWith("#journey-")
    return pathname === path && (!anchor ? !hash : hash === `#${anchor}`)
  }
  const close = () => setOpen(false)
  return (
    <header ref={header} className="oc-public-nav" data-hero={hero && !scrolled} data-open={open} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close()
    }}>
      <div className="oc-public-nav-surface">
        <div className="oc-public-nav-row">
          <Link prefetch={false} className="oc-public-logo" href="/" aria-label="OutClass home" onClick={close}>
            <span className="oc-public-logo-light"><OutClassLogo variant="light" /></span>
            <span className="oc-public-logo-dark" aria-hidden="true"><OutClassLogo variant="dark" /></span>
          </Link>
          <nav className="oc-public-desktop" aria-label="Main navigation">
            {links.map(link => <a className="oc-public-link" key={link.href} href={link.href} aria-current={active(link.href) ? (link.href.includes("#") ? "location" : "page") : undefined}><RollingNavigationLabel>{link.label}</RollingNavigationLabel></a>)}
          </nav>
          <div className="oc-public-account">
            <a className="oc-public-login" href="/login" onClick={close}><RollingNavigationLabel>Log In</RollingNavigationLabel></a>
            <Button className="oc-public-primary" asChild><Link prefetch={false} href="/signup" onClick={close}><RollingNavigationLabel>Get Started</RollingNavigationLabel></Link></Button>
            <button ref={toggle} type="button" className="oc-public-menu-toggle" aria-expanded={open} aria-controls={mobileMenuId} aria-label={open ? "Close navigation menu" : "Open navigation menu"} onClick={() => setOpen(value => !value)}>
              <span className="oc-public-menu-icon" aria-hidden="true"><span /><span /></span>
            </button>
          </div>
        </div>
        <nav id={mobileMenuId} className="oc-public-mobile" aria-label="Mobile navigation" inert={!open} aria-hidden={!open}>
          <div className="oc-public-mobile-clip">
            <div className="oc-public-mobile-links">
              {links.map(link => <a className="oc-public-link" key={link.href} href={link.href} onClick={close} aria-current={active(link.href) ? (link.href.includes("#") ? "location" : "page") : undefined}><RollingNavigationLabel>{link.label}</RollingNavigationLabel></a>)}
              <a className="oc-public-link oc-public-mobile-login" href="/login" onClick={close}><RollingNavigationLabel>Log In</RollingNavigationLabel></a>
            </div>
          </div>
        </nav>
      </div>
    </header>
  )
}
