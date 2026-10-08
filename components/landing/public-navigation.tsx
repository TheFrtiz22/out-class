"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { OutClassLogo } from "@/components/outclass-logo"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import "./public-navigation.css"

const links = [
  { label: "How It Works", href: "/#about" },
  { label: "About OutClass", href: "/about" },
  { label: "FAQ", href: "/uva#faq" },
] as const

/** Shared marketing header. Account workspaces keep their own navigation. */
export function PublicNavigation({ hero = false, onGetStarted }: {
  hero?: boolean
  onGetStarted?: () => void
}) {
  const pathname = usePathname()
  const { user, activeClubId, isImpersonating } = useAuth()
  const { isDemoEnabled } = useDemoMode()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [hash, setHash] = useState("")
  const [platformAdmin, setPlatformAdmin] = useState<{ userId: string; eligible: boolean } | null>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const header = useRef<HTMLElement>(null)
  useEffect(() => {
    const update = () => { setScrolled(window.scrollY > 32); setHash(window.location.hash) }
    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("hashchange", update)
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("hashchange", update) }
  }, [])
  useEffect(() => {
    if (!user || isImpersonating || isDemoEnabled) return
    let live = true
    fetch("/api/platform/eligibility").then(r => r.ok ? r.json() : null)
      .then(data => { if (live) setPlatformAdmin({ userId: user.id, eligible: data?.eligible === true }) }).catch(() => {})
    return () => { live = false }
  }, [user, isImpersonating, isDemoEnabled])
  useEffect(() => {
    if (!open) return
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggle.current?.focus() }
    }
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(false)
    }
    const desktop = window.matchMedia("(min-width: 1100px)")
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false) }
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
  const accountDestination = platformAdmin?.userId === user?.id && platformAdmin?.eligible && !isImpersonating ? "/platform" : activeClubId
    ? `/club/${encodeURIComponent(activeClubId)}/workspace` : "/?workspace=student"
  const getStartedHref = user && !isDemoEnabled ? accountDestination : "/?signup=student"
  const close = () => setOpen(false)
  return (
    <header ref={header} className="oc-public-nav" data-hero={hero && !scrolled && !open} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close()
    }}>
      <div className="oc-public-nav-row">
        <Link prefetch={false} className="oc-public-logo" href="/" aria-label="OutClass home" onClick={close}>
          <OutClassLogo variant={hero && !scrolled && !open ? "dark" : "light"} />
        </Link>
        <nav className="oc-public-desktop" aria-label="Main navigation">
          {links.map(link => <a key={link.href} href={link.href} aria-current={active(link.href) ? (link.href.includes("#") ? "location" : "page") : undefined}>{link.label}</a>)}
        </nav>
        <div className="oc-public-account">
          <a className="oc-public-login" href="/login">Log In</a>
          <Button className="oc-public-primary" asChild><Link prefetch={false} href={getStartedHref} onClick={event => {
            close()
            if (user && !isDemoEnabled || !onGetStarted || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            onGetStarted()
          }}>Get Started</Link></Button>
          <button ref={toggle} type="button" className="oc-public-menu-toggle" aria-expanded={open} aria-controls="public-mobile-menu" aria-label={open ? "Close navigation menu" : "Open navigation menu"} onClick={() => setOpen(value => !value)}>
            {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <nav id="public-mobile-menu" className="oc-public-mobile" aria-label="Mobile navigation" hidden={!open}>
        {links.map(link => <a key={link.href} href={link.href} onClick={close} aria-current={active(link.href) ? (link.href.includes("#") ? "location" : "page") : undefined}>{link.label}</a>)}
      </nav>
    </header>
  )
}
