"use client"
import { ArrowDown, ArrowUp } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { PillSelect } from "@/components/ui/pill-select"
import { cn } from "@/lib/utils"

export type SortOption<K extends string = string> = { key: K; label: string }

/**
 * "Sort: <field> ↑/↓" for a list toolbar. Shown at every width (in card layouts it is the only sort
 * control) and driven by the same state as the table's column headers.
 */
export function SortControl<K extends string>({ options, value, descending, onChange, label = "Sort", descendingByDefault, disabled, className }: {
  options: readonly SortOption<K>[]
  value: K
  descending: boolean
  /** Picking a field calls this with that field's natural direction; the arrow flips the current one. */
  onChange: (key: K, descending: boolean) => void
  /** Accessible name of the group, e.g. "Sort applicants". */
  label?: string
  /** Natural direction for a newly picked field (numbers and dates usually start high). */
  descendingByDefault?: (key: K) => boolean
  disabled?: boolean
  className?: string
}) {
  const current = options.find(option => option.key === value)?.label ?? value
  return <div role="group" aria-label={label} data-sort-control="" className={cn("oc-sort-control", className)}>
    <PillSelect label={`${label} by`} prefix="Sort:" size="compact" active={false} disabled={disabled} value={value}
      onChange={next => onChange(next as K, next === value ? descending : descendingByDefault?.(next as K) ?? false)}
      options={options.map(option => ({ value: option.key, label: option.label }))} />
    <Button type="button" variant="ghost" size="icon" className="oc-sort-direction" disabled={disabled}
      aria-label={`${current}, ${descending ? "descending" : "ascending"}. Switch to ${descending ? "ascending" : "descending"}`}
      onClick={() => onChange(value, !descending)}>
      {descending ? <ArrowDown size={16} aria-hidden="true" /> : <ArrowUp size={16} aria-hidden="true" />}
    </Button>
  </div>
}
