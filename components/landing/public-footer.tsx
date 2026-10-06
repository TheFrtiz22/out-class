import type { ReactNode } from "react"
import { OutClassLogo } from "@/components/outclass-logo"

export function PublicFooter({ homeHref = "/", overviewHref = "/#about", children }: {
  homeHref?: string
  overviewHref?: string
  children?: ReactNode
}) {
  return (
    <footer className="oc-public-footer">
      <div>
        <a href={homeHref} aria-label="OutClass home"><OutClassLogo className="h-8 w-auto" /></a>
        <p>Find your people. Make your mark.</p>
      </div>
      <nav aria-label="Footer navigation">
        <a href={overviewHref}>How it works</a>
        <a href="/about">About OutClass</a>
        <a href="/uva">OutClass at UVA</a>
        {children}
      </nav>
      <small>© {new Date().getFullYear()} OutClass</small>
    </footer>
  )
}
