import type { MouseEvent } from "react"
import Link from "next/link"
import { ChevronRight } from "@/components/icons"
import { cn } from "@/lib/utils"

export type BreadcrumbItem = { label: string; href?: string }

/**
 * Where this page sits: an ordered list of links ending in the current page (not a link).
 * `onLinkClick` lets a workspace keep its unsaved-changes guard on these links.
 */
export function Breadcrumbs({ items, className, onLinkClick }: { items: BreadcrumbItem[]; className?: string; onLinkClick?: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  if (items.length < 2) return null
  return <nav aria-label="Breadcrumb" className={cn("oc-breadcrumbs", className)}>
    <ol>
      {items.map((item, index) => {
        const current = index === items.length - 1
        return <li key={`${index}:${item.label}`}>
          {current || !item.href
            ? <span aria-current={current ? "page" : undefined}>{item.label}</span>
            : <Link href={item.href} onClick={onLinkClick}>{item.label}</Link>}
          {!current && <ChevronRight size={14} aria-hidden="true" className="oc-breadcrumbs-separator" />}
        </li>
      })}
    </ol>
  </nav>
}
