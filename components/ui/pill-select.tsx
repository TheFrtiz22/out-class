"use client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

/** Radix items cannot carry "", so the "all" choice travels under this value and maps back to "". */
const EMPTY = "__oc_all__"

export type PillSelectOption = { value: string; label: string; disabled?: boolean }

/**
 * A dropdown for long lists that must stay a dropdown (majors, clubs, rounds): a pill trigger in the
 * segmented track's material, a card-style menu, listbox keyboard and typeahead from Radix.
 * `value` "" means the `allLabel` choice when one is given. Callers keep their own string state.
 */
export function PillSelect({ label, options, value, onChange, allLabel, placeholder, className, disabled, id, size = "default", describedBy, active, prefix }: {
  /** Accessible name, e.g. "Filter major". */
  label: string
  options: PillSelectOption[]
  value: string
  onChange: (value: string) => void
  /** Adds a first "All …" option whose value is "". */
  allLabel?: string
  placeholder?: string
  className?: string
  disabled?: boolean
  id?: string
  size?: "default" | "compact"
  /** id of a note that explains the choices (aria-describedby on the trigger). */
  describedBy?: string
  /** Whether the choice narrows the view (navy fill). Defaults to `value !== ""`; pass it when the default isn't "". */
  active?: boolean
  /** Short visible label inside the pill before the value ("Sort"); the accessible name starts with it. */
  prefix?: string
}) {
  const items = allLabel ? [{ value: EMPTY, label: allLabel }, ...options.filter(option => option.value !== "")] : options.map(option => option.value === "" ? { ...option, value: EMPTY } : option)
  // "" without an "all" option stays controlled: Radix shows the placeholder for "" (undefined would make it uncontrolled).
  const current = value === "" && items.some(item => item.value === EMPTY) ? EMPTY : value
  return <Select value={current} onValueChange={next => onChange(next === EMPTY ? "" : next)} disabled={disabled}>
    <SelectTrigger id={id} aria-label={label} aria-describedby={describedBy} data-value={value} data-pill="" data-pill-size={size} data-active={(active ?? value !== "") || undefined}
      className={cn("oc-pill-select-trigger", className)}>
      {prefix && <span className="oc-pill-select-prefix" aria-hidden="true">{prefix}</span>}
      <SelectValue placeholder={placeholder ?? allLabel ?? label} />
    </SelectTrigger>
    <SelectContent className="oc-pill-select-content" collisionPadding={16}>
      {items.map(item => <SelectItem key={item.value} value={item.value} data-value={item.value === EMPTY ? "" : item.value} disabled={item.disabled}>{item.label}</SelectItem>)}
    </SelectContent>
  </Select>
}
