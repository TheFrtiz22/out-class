"use client"

import { Plus, Trophy, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Accolade } from "@/lib/data"

type AccoladeListProps = {
  values: Accolade[]
  onChange: (values: Accolade[]) => void
}

export function AccoladeList({ values, onChange }: AccoladeListProps) {
  function updateText(id: string, text: string) {
    onChange(values.map((a) => (a.id === id ? { ...a, text } : a)))
  }

  function remove(id: string) {
    onChange(values.filter((a) => a.id !== id))
  }

  function add() {
    onChange([...values, { id: `acc-${Date.now()}`, text: "" }])
  }

  return (
    <div className="space-y-1.5">
      <Label>Accolades &amp; competition wins</Label>
      <div className="space-y-2">
        {values.map((accolade) => (
          <div key={accolade.id} className="flex items-center gap-2">
            <Trophy className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={accolade.text}
              onChange={(e) => updateText(accolade.id, e.target.value)}
              placeholder="2025 National Stock Pitch Champions"
              className="h-9"
            />
            <button
              type="button"
              onClick={() => remove(accolade.id)}
              className="shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Remove accolade"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <Plus className="size-4" /> Add Accolade
        </button>
      </div>
    </div>
  )
}
