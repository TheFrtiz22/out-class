"use client"
import { useState } from "react"
import { SegmentedControl, type SegmentOption } from "@/components/ui/segmented-control"

type Common<T extends string> = {
  label: string
  options: SegmentOption<T>[]
  /** Chips shown before "+N more"; selected chips beyond it always stay visible. Omit to show all. */
  visible?: number
  /** Accessible name for the expander; must start with the visible "+N". Defaults to "+N more {label}". */
  moreLabel?: (hidden: number) => string
  className?: string
  size?: "default" | "compact"
}
type Single<T extends string> = Common<T> & { multiple?: false; value: T; onChange: (value: T) => void }
type Multiple<T extends string> = Common<T> & { multiple: true; value: T[]; onChange: (value: T[]) => void }

/**
 * A chip row in the pill style (the segmented control's chip mode). Long lists collapse behind a
 * "+N more" chip that expands inline, in place of long dropdowns (categories, interests, roles, groups).
 */
export function FilterChips<T extends string>(props: Single<T> | Multiple<T>) {
  const { label, options, visible, moreLabel, className, size = "compact" } = props
  const [expanded, setExpanded] = useState(false)
  const isSelected = (value: T) => props.multiple ? props.value.includes(value) : props.value === value
  const collapsed = !expanded && visible != null && options.length > visible
  const shown = collapsed ? options.filter((option, i) => i < visible || isSelected(option.value)) : options
  const hidden = options.length - shown.length
  const more = visible != null && options.length > visible
    ? <button type="button" className="oc-filter-chips-more" aria-expanded={expanded}
      aria-label={expanded ? `Fewer ${label.toLowerCase()}` : moreLabel?.(hidden) ?? `+${hidden} more ${label.toLowerCase()}`}
      onClick={() => setExpanded(value => !value)}>{expanded ? "Fewer" : `+${hidden}`}</button>
    : undefined
  // Chip rows never slide: several chips can be on, and a chip row re-flows as it expands.
  return props.multiple
    ? <SegmentedControl multiple label={label} options={shown} value={props.value} onChange={props.onChange} size={size} className={className} after={more} />
    : <SegmentedControl label={label} options={shown} value={props.value} onChange={props.onChange} size={size} animated={false} className={className} after={more} />
}
