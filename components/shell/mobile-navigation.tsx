"use client"
import Link from "next/link"
import { Home, Compass, Bookmark, FileText, Users2, Menu, Video, CalendarDays, CheckCircle2, Megaphone, Settings, RefreshCw, ListChecks, type IconComponent } from "@/components/icons"
import type { ProductNavItem } from "@/lib/product-navigation"
import { handleClubLink } from "@/lib/workspace-navigation"

const icons: Record<string, IconComponent> = { "student-dashboard": Home, "club-home": Home, explore: Compass, categories: Compass, status: CheckCircle2, calendar: CalendarDays, corkboard: Bookmark, applications: FileText, clubs: Users2, overview: Home, applicants: Users2, interviews: Video, meetings: CalendarDays, "club-meetings": CalendarDays, tasks: ListChecks, "club-tasks": ListChecks, members: Users2, decisions: CheckCircle2, "scheduled-decisions": CheckCircle2, letters: FileText, announcements: Megaphone, settings: Settings, cycles: RefreshCw }

/** Phones: the only section navigation. `items` come from lib/navigation's bottomBarItems. */
export function MobileNavigation({ items, groups, active, onSelect, onLink, onMore }: {
  items: ProductNavItem[]; groups: ProductNavItem[]; active: string; onSelect: (id: string) => void; onLink: (event: React.MouseEvent<HTMLAnchorElement>) => void; onMore: () => void
}) {
  const activeGroup = groups.find(item => item.id === active)?.navGroup
  return <nav className="oc-mobile-navigation" aria-label="Sections">
    {items.map(item => {
      const Icon = icons[item.id] || Home
      const props = { className: "oc-mobile-destination", "aria-current": (active === item.id || !!item.navGroup && item.navGroup === activeGroup) ? "page" as const : undefined }
      const content = <><Icon size={20} weight={props["aria-current"] ? "fill" : "regular"} aria-hidden="true" /><span>{item.label}</span></>
      return item.href ? <Link key={item.id} href={item.href} prefetch={false} {...props} onClick={event => { onLink(event); handleClubLink(event, item.href!) }}>{content}</Link> : <button type="button" key={item.id} {...props} onClick={() => onSelect(item.id)}>{content}</button>
    })}
    <button type="button" data-navigation-toggle className="oc-mobile-destination" aria-label="More sections" onClick={onMore}><Menu size={20} aria-hidden="true" /><span>More</span></button>
  </nav>
}
