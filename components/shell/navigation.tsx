"use client"

import type { NavItem, ViewId } from "@/lib/views"
import { cn } from "@/lib/utils"

export function ShellNavigation({ items, view, onNavigate, label, mobile = false }: {
  items: NavItem[]
  view: ViewId
  onNavigate: (view: ViewId) => void
  label: string
  mobile?: boolean
}) {
  return <nav aria-label={label} className={cn(mobile ? "grid grid-cols-5 gap-1" : "space-y-1")}>
    {items.map(({ id, title, icon: Icon }) => {
      const active = view === id
      return <button key={id} type="button" onClick={() => onNavigate(id)} aria-current={active ? "page" : undefined}
        className={cn("shell-nav-item group relative flex min-h-11 w-full items-center rounded-md text-sm transition-colors motion-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", mobile ? "flex-col justify-center gap-1 px-1 py-2 text-[11px]" : "gap-3 px-3 py-2.5 text-left", active ? "bg-accent font-semibold text-primary" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground")}>
        <span aria-hidden="true" className={cn("absolute rounded-full bg-primary transition-[opacity,transform] motion-ui", mobile ? "inset-x-4 top-0 h-0.5" : "inset-y-3 left-0 w-0.5", active ? "scale-100 opacity-100" : "scale-75 opacity-0")} />
        <Icon aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.65} />
        <span>{title}</span>
      </button>
    })}
  </nav>
}
