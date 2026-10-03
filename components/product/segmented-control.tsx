"use client"
import { cn } from "@/lib/utils"

export function SegmentedControl<T extends string>({ label, value, options, onChange, className }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; className?: string
}) {
  return <div role="group" aria-label={label} className={cn("oc-segmented-control", className)}>{options.map(option =>
    <button type="button" key={option.value} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>
  )}</div>
}
