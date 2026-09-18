"use client"

import { Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { brandColorPresets } from "@/lib/data"
import { cn } from "@/lib/utils"

type ColorPickerProps = {
  value: string
  onChange: (hex: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const isValidHex = /^#([0-9A-Fa-f]{3}){1,2}$/.test(value)

  return (
    <div className="space-y-2.5">
      <Label>Primary brand accent color</Label>
      <div className="flex flex-wrap gap-3">
        {brandColorPresets.map((preset) => {
          const active = value.toLowerCase() === preset.hex.toLowerCase()
          return (
            <button
              key={preset.hex}
              type="button"
              onClick={() => onChange(preset.hex)}
              className="group flex flex-col items-center gap-1.5"
              aria-label={`Choose ${preset.name}`}
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform group-hover:scale-110",
                  active && "ring-2 ring-ring",
                )}
                style={{ backgroundColor: preset.hex }}
              >
                {active && <Check className="size-4 text-white drop-shadow" />}
              </span>
              <span className="text-[11px] text-muted-foreground">{preset.name}</span>
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <span
          className="size-8 shrink-0 rounded-md border"
          style={{ backgroundColor: isValidHex ? value : "transparent" }}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#232D4B"
          className="h-8 max-w-[140px] font-mono text-xs uppercase"
          aria-label="Custom hex code"
        />
        <span className="text-xs text-muted-foreground">Custom HEX</span>
      </div>
    </div>
  )
}
