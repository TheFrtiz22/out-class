"use client"
import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"

export function SegmentedControl<T extends string>({ label, value, options, onChange, className, animated = false }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; className?: string; animated?: boolean
}) {
  const index = options.findIndex(option => option.value === value)
  return <div role="group" aria-label={label} className={cn("oc-segmented-control", className)} data-sliding={animated || undefined} data-has-active={index >= 0} style={animated ? { "--segment-count": options.length, "--segment-index": Math.max(0, index) } as CSSProperties : undefined}>
    {animated && <span className="oc-segmented-indicator" aria-hidden="true" />}
    {options.map(option =>
    <button type="button" key={option.value} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>
  )}</div>
}
