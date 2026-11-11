"use client"
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { MoreHorizontal } from "@/components/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { IconButton } from "@/components/ui/icon-button"

/**
 * One "⋯" menu for the Scheduling tab. The header owns the schedule-wide items
 * (Applicant preview, Booking settings); the current step adds its own (for
 * example Assignment rules) through `useSchedulingTools`, so the page never
 * shows two tool menus or a menu that opens another menu.
 */
export type SchedulingTool = { id: string; label: string; onSelect: () => void; disabled?: boolean }
type Registry = { set: (owner: object, tools: SchedulingTool[] | null) => void }
const ToolsContext = createContext<Registry | null>(null)
const StepToolsContext = createContext<SchedulingTool[]>([])

export function SchedulingToolsProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<{ owner: object; tools: SchedulingTool[] }[]>([])
  const set = useCallback((owner: object, tools: SchedulingTool[] | null) => setEntries(current => {
    const others = current.filter(entry => entry.owner !== owner)
    return tools ? [...others, { owner, tools }] : others
  }), [])
  const registry = useRef<Registry>({ set }).current
  return <ToolsContext.Provider value={registry}><StepToolsContext.Provider value={entries.flatMap(entry => entry.tools)}>{children}</StepToolsContext.Provider></ToolsContext.Provider>
}

/** Register the current step's items. Handlers always run their latest version. */
export function useSchedulingTools(tools: SchedulingTool[]) {
  const registry = useContext(ToolsContext)
  const owner = useRef({}).current
  const latest = useRef(tools)
  latest.current = tools
  const signature = tools.map(tool => `${tool.id}:${tool.label}:${tool.disabled ? 1 : 0}`).join("|")
  useEffect(() => {
    if (!registry) return
    registry.set(owner, latest.current.map(tool => ({ ...tool, onSelect: () => latest.current.find(item => item.id === tool.id)?.onSelect() })))
  }, [registry, owner, signature])
  useEffect(() => () => registry?.set(owner, null), [registry, owner])
  return !!registry
}

export function SchedulingOverflowMenu({ items, disabled }: { items: SchedulingTool[]; disabled?: boolean }) {
  const stepItems = useContext(StepToolsContext)
  const all = [...items, ...stepItems]
  if (!all.length) return null
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><IconButton variant="outline" aria-label="More scheduling actions" title="More scheduling actions" disabled={disabled}><MoreHorizontal aria-hidden="true" /></IconButton></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {items.map(item => <DropdownMenuItem key={item.id} className="min-h-11" disabled={item.disabled} onSelect={item.onSelect}>{item.label}</DropdownMenuItem>)}
      {!!items.length && !!stepItems.length && <DropdownMenuSeparator />}
      {stepItems.map(item => <DropdownMenuItem key={item.id} className="min-h-11" disabled={item.disabled} onSelect={item.onSelect}>{item.label}</DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>
}
