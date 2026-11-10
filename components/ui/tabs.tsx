'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

import { cn } from '@/lib/utils'

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

const useBrowserLayoutEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect

/**
 * Segmented lists place one indicator on the active trigger's measured box and follow Radix's
 * data-state changes, so the indicator slides between tabs at any count instead of repainting.
 */
function useSegmentIndicator(list: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  useBrowserLayoutEffect(() => {
    const el = list.current
    if (!enabled || !el) return
    const place = () => {
      const active = el.querySelector<HTMLElement>(':scope > [data-slot="tabs-trigger"][data-state="active"]')
      if (!active || !active.offsetWidth) { el.removeAttribute('data-measured'); return }
      el.style.setProperty('--indicator-x', `${active.offsetLeft}px`)
      el.style.setProperty('--indicator-width', `${active.offsetWidth}px`)
      el.setAttribute('data-measured', 'true')
    }
    place()
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
    const observeTriggers = () => el.querySelectorAll(':scope > [data-slot="tabs-trigger"]').forEach(trigger => resize?.observe(trigger))
    // Triggers added later (counts, late data) are observed too, so their size changes re-place the indicator.
    const mutations = new MutationObserver(() => { observeTriggers(); place() })
    mutations.observe(el, { subtree: true, attributes: true, attributeFilter: ['data-state'], childList: true })
    resize?.observe(el)
    observeTriggers()
    return () => { mutations.disconnect(); resize?.disconnect() }
  }, [list, enabled])
}

function TabsList({
  className,
  variant = 'segmented',
  ref,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & { variant?: 'subtle' | 'underline' | 'segmented' }) {
  const list = React.useRef<HTMLDivElement | null>(null)
  useSegmentIndicator(list, variant === 'segmented')
  const setRef = React.useCallback((node: HTMLDivElement | null) => {
    list.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) (ref as React.RefObject<HTMLDivElement | null>).current = node
  }, [ref])
  return (
    <TabsPrimitive.List
      ref={setRef}
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(
        'group/tabs text-muted-foreground inline-flex min-h-10 w-fit max-w-full items-center justify-start overflow-x-auto',
        variant === 'underline' ? 'gap-4 rounded-none border-b border-border bg-transparent p-0' : variant === 'segmented' ? 'w-full' : 'gap-1 rounded-full bg-muted p-[3px]',
        className,
      )}
      {...props}
    >
      {children}
      {variant === 'segmented' && <span className="oc-tabs-indicator" aria-hidden="true" />}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] motion-micro focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-none group-data-[variant=underline]/tabs:rounded-none group-data-[variant=underline]/tabs:border-0 group-data-[variant=underline]/tabs:border-b-2 group-data-[variant=underline]/tabs:bg-transparent group-data-[variant=underline]/tabs:px-0 group-data-[variant=underline]/tabs:data-[state=active]:border-primary [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
