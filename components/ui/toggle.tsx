"use client"
import { useId, type ReactNode } from "react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

/**
 * A labelled pill switch for boolean filters and settings (role="switch", aria-checked from Radix).
 * The whole pill is the hit area; the visible label is the switch's accessible name.
 */
export function Toggle({ label, checked, onCheckedChange, description, disabled, className, id }: {
  label: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  description?: ReactNode
  disabled?: boolean
  className?: string
  id?: string
}) {
  const generated = useId(), switchId = id ?? `${generated}-switch`, labelId = `${generated}-label`, descriptionId = `${generated}-description`
  return <div className={cn("oc-toggle", className)} data-slot="toggle" data-checked={checked || undefined} data-disabled={disabled || undefined}>
    <span className="oc-toggle-text">
      <label id={labelId} htmlFor={switchId} className="oc-toggle-label">{label}</label>
      {description && <span id={descriptionId} className="oc-toggle-description">{description}</span>}
    </span>
    <Switch id={switchId} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled}
      aria-labelledby={labelId} aria-describedby={description ? descriptionId : undefined} className="oc-toggle-switch" />
  </div>
}
