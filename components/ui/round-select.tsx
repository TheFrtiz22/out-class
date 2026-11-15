"use client"
import { PillSelect } from "@/components/ui/pill-select"

export type RoundOption = { id: string; name: string }

/**
 * The one round filter: a compact "Round: All ▾" dropdown generated from the cycle's real rounds.
 * `value` "" is "All" when `includeAll` (the default); pages that never had an "All" choice pass
 * `includeAll={false}` and keep a concrete round selected.
 */
export function RoundSelect({ rounds, value, onChange, includeAll = true, allLabel = "All", label = "Round", prefix = "Round", id, className, disabled }: {
  rounds: RoundOption[]
  value: string
  onChange: (value: string) => void
  includeAll?: boolean
  allLabel?: string
  /** Accessible name; the visible prefix is `prefix`. */
  label?: string
  prefix?: string
  id?: string
  className?: string
  disabled?: boolean
}) {
  return <PillSelect id={id} label={label} prefix={prefix} size="compact" active={false} disabled={disabled}
    className={className} allLabel={includeAll ? allLabel : undefined} placeholder={includeAll ? undefined : "Choose a round"}
    value={value} onChange={onChange} options={rounds.map(round => ({ value: round.id, label: round.name }))} />
}
