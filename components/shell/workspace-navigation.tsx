"use client"
import { useEffect, useId, useState, type ReactNode } from "react"
import { CheckCircle2, ChevronDown, Users2 } from "lucide-react"
import { navigationGroupLabels, type ProductNavItem } from "@/lib/product-navigation"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

type Group = NonNullable<ProductNavItem["navGroup"]>
function NavigationGroup({ group, items, active, renderItem }: { group: Group; items: ProductNavItem[]; active: string; renderItem: (item: ProductNavItem) => ReactNode }) {
  const selected = items.some(item => item.id === active)
  const [open, setOpen] = useState(selected)
  const id = useId()
  useEffect(() => { if (selected) setOpen(true) }, [selected, active])
  const Icon = group === "applicants" ? Users2 : CheckCircle2
  return <Collapsible open={open} onOpenChange={setOpen} className="oc-workspace-nav-group">
    <CollapsibleTrigger asChild><button type="button" data-navigation-toggle data-active={selected || undefined} aria-controls={id} aria-expanded={open} className={cn("flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring", selected ? "font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon aria-hidden="true" className="size-[18px] shrink-0" /><span className="flex-1">{navigationGroupLabels[group]}</span><ChevronDown aria-hidden="true" className={cn("size-4 transition-transform duration-150 motion-reduce:transition-none", open && "rotate-180")} /></button></CollapsibleTrigger>
    <CollapsibleContent id={id} className="oc-workspace-nav-children"><div className="ml-5 space-y-1 border-l border-current/15 pl-2">{items.map(renderItem)}</div></CollapsibleContent>
  </Collapsible>
}
/** Retain flat route/permission data; group only its desktop and mobile-drawer presentation. */
export function WorkspaceNavigation({ items, active, renderItem }: { items: ProductNavItem[]; active: string; renderItem: (item: ProductNavItem) => ReactNode }) {
  const rendered = new Set<Group>()
  return <>{items.map(item => {
    if (!item.navGroup) return renderItem(item)
    if (rendered.has(item.navGroup)) return null
    rendered.add(item.navGroup)
    return <NavigationGroup key={item.navGroup} group={item.navGroup} items={items.filter(child => child.navGroup === item.navGroup)} active={active} renderItem={renderItem} />
  })}</>
}
