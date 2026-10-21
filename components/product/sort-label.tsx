"use client"

import { ArrowDown, ArrowUp } from "@/components/icons"

export function SortLabel({ label, active, descending, onClick }: { label: string; active: boolean; descending: boolean; onClick: () => void }) {
  const Icon = active && descending ? ArrowDown : ArrowUp
  return <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center gap-2 rounded text-left font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={`Sort by ${label}${active ? descending ? ", currently descending" : ", currently ascending" : ""}`}>
    {label}<Icon size={14} aria-hidden="true" className={active ? "" : "opacity-30"} />
  </button>
}
