"use client"
import Link from "next/link"
import { Home, Compass, Bookmark, FileText, Users2, Menu, Video, CalendarDays, CheckCircle2, type LucideIcon } from "lucide-react"
import type { ProductNavItem } from "@/lib/product-navigation"
import { handleClubLink } from "@/lib/workspace-navigation"

const icons: Record<string, LucideIcon> = { "student-dashboard": Home, explore: Compass, categories: Compass, status: CheckCircle2, calendar: CalendarDays, corkboard: Bookmark, applications: FileText, clubs: Users2, overview: Home, applicants: Users2, interviews: Video, meetings: Users2, tasks: FileText, members: Users2 }
export function MobileNavigation({ items, active, manager, onSelect, onLink, onMore }: {
  items: ProductNavItem[]; active: string; manager: boolean; onSelect: (id: string) => void; onLink: (event: React.MouseEvent<HTMLAnchorElement>) => void; onMore: () => void
}) {
  const primary = manager ? items.filter(item => !item.quiet).slice(0, 4) : [{ id: "student-dashboard", label: "Home" }, ...items.filter(item => !item.quiet).slice(0, 3)]
  return <nav className="oc-mobile-navigation" aria-label="Primary mobile navigation">
    {primary.map(item => {
      const Icon = icons[item.id] || Home
      const props = { className: "oc-mobile-destination", "aria-current": active === item.id ? "page" as const : undefined }
      const content = <><Icon size={20} aria-hidden="true" /><span>{item.id === "student-dashboard" ? "Home" : item.label}</span></>
      return item.href ? <Link key={item.id} href={item.href} prefetch={false} {...props} onClick={event => { onLink(event); handleClubLink(event, item.href!) }}>{content}</Link> : <button type="button" key={item.id} {...props} onClick={() => onSelect(item.id)}>{content}</button>
    })}
    <button type="button" className="oc-mobile-destination" aria-label="More navigation and workspaces" onClick={onMore}><Menu size={20} aria-hidden="true" /><span>More</span></button>
  </nav>
}
