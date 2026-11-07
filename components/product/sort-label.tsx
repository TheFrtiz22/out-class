"use client"

import { ArrowDown, ArrowUp } from "@/components/icons"
import { Button } from "@/components/ui/button"

export function SortLabel({ label, active, descending, onClick }: { label: string; active: boolean; descending: boolean; onClick: () => void }) {
  const Icon = active && descending ? ArrowDown : ArrowUp
  return <Button type="button" variant="ghost" size="sm" onClick={onClick} className="h-auto min-h-11 justify-start px-1 text-left font-medium" aria-label={`Sort by ${label}${active ? descending ? ", currently descending" : ", currently ascending" : ""}`}>
    {label}<Icon size={14} aria-hidden="true" className={active ? "" : "opacity-30"} />
  </Button>
}
