"use client"
import { useEffect, useState, type ComponentProps, type ReactNode } from "react"
import { SlidersHorizontal } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

/** The "Filters" pill with an active-filter count badge. The count is also part of the accessible name. */
export function FilterButton({ count = 0, label = "Filters", className, children, ...props }: ComponentProps<typeof Button> & { count?: number; label?: string }) {
  return <Button type="button" variant="outline" data-filter-button="" className={cn("oc-filter-button", className)} data-active={count > 0 || undefined} {...props}>
    <SlidersHorizontal aria-hidden="true" />{children ?? label}
    {count > 0 && <><span className="sr-only">, {count} active</span><span className="oc-filter-button-count" aria-hidden="true">{count}</span></>}
  </Button>
}

const PHONE = "(max-width: 639px)"
function usePhone() {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const query = window.matchMedia(PHONE)
    const sync = () => setPhone(query.matches)
    sync()
    query.addEventListener?.("change", sync)
    return () => query.removeEventListener?.("change", sync)
  }, [])
  return phone
}

/**
 * The filter panel container. On wider screens it is a popover that flips and shifts to stay inside the
 * viewport (16px gutter) and scrolls internally when tall; on phones it becomes a bottom sheet.
 * Focus moves into the panel on open and returns to the trigger on close (Radix).
 */
export function FilterPopover({ count = 0, label = "Filters", title = "Filters", description, children, footer, open, onOpenChange, align = "end", className, triggerClassName, id }: {
  count?: number; label?: string; title?: string; description?: string
  children: ReactNode; footer?: ReactNode
  open?: boolean; onOpenChange?: (open: boolean) => void
  align?: "start" | "center" | "end"; className?: string; triggerClassName?: string; id?: string
}) {
  const phone = usePhone()
  const [ownOpen, setOwnOpen] = useState(false)
  const isOpen = open ?? ownOpen
  const setOpen = (next: boolean) => { if (open === undefined) setOwnOpen(next); onOpenChange?.(next) }
  const trigger = <FilterButton count={count} label={label} className={triggerClassName} aria-expanded={isOpen} />
  const body = <>
    <div className="oc-filter-panel-body">{children}</div>
    {footer && <div className="oc-filter-panel-footer">{footer}</div>}
  </>
  if (phone) return <Sheet open={isOpen} onOpenChange={setOpen}>
    <SheetTrigger asChild>{trigger}</SheetTrigger>
    <SheetContent side="bottom" id={id} className={cn("oc-filter-sheet", className)}>
      <SheetHeader className="px-0 pb-0"><SheetTitle>{title}</SheetTitle>{description ? <SheetDescription>{description}</SheetDescription> : <SheetDescription className="sr-only">Narrow the list. Changes apply as you choose them.</SheetDescription>}</SheetHeader>
      {body}
    </SheetContent>
  </Sheet>
  return <Popover open={isOpen} onOpenChange={setOpen}>
    <PopoverTrigger asChild>{trigger}</PopoverTrigger>
    <PopoverContent id={id} role="dialog" aria-label={title} align={align} sideOffset={8} collisionPadding={16} avoidCollisions className={cn("oc-filter-popover", className)}>
      {description && <p className="oc-filter-panel-description">{description}</p>}
      {body}
    </PopoverContent>
  </Popover>
}
