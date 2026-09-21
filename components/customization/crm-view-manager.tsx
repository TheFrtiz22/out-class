"use client"

import { useState } from "react"
import { LayoutGrid, Rows3, SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { crmColumns, emptyFilters, useClubCustomization } from "@/lib/club-customization"

/** Controls the existing CRM table, filters, and board through shared club state. */
export function CRMViewManager({ clubId = "vvf" }: { clubId?: string }) {
  const { state, update, ready, storageError } = useClubCustomization(clubId)
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const { crm } = state
  function saveView() {
    const trimmed = name.trim()
    if (!trimmed || crm.views.some(view => view.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("Enter a unique view name."); return
    }
    const id = crypto.randomUUID()
    update(previous => ({ ...previous, crm: { ...previous.crm, activeView: id, views: [...previous.crm.views, { id, name: trimmed, filters: structuredClone(previous.crm.filters) }] } }))
    setName(""); setError("")
  }
  return <fieldset disabled={!ready} className="min-w-0 space-y-3 font-sans">
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3">
      <div className="flex flex-wrap gap-1" aria-label="Saved CRM views">
        <Button variant="ghost" className="shadow-none hover:bg-neutral-50" aria-pressed={crm.activeView === "all"} onClick={() => update(p => ({ ...p, crm: { ...p.crm, activeView: "all", filters: emptyFilters } }))}>All applicants</Button>
        {crm.views.map(view => <div key={view.id} className="flex items-center rounded-xl border border-neutral-200">
          <Button variant="ghost" className="shadow-none hover:bg-neutral-50" aria-pressed={crm.activeView === view.id} onClick={() => update(p => ({ ...p, crm: { ...p.crm, activeView: view.id, filters: structuredClone(view.filters) } }))}>{view.name}{crm.activeView === view.id && JSON.stringify(crm.filters) !== JSON.stringify(view.filters) ? " (edited)" : ""}</Button>
          <Button size="icon" variant="ghost" aria-label={`Delete view ${view.name}`} onClick={() => update(p => ({ ...p, crm: { ...p.crm, views: p.crm.views.filter(v => v.id !== view.id), activeView: p.crm.activeView === view.id ? "all" : p.crm.activeView, filters: p.crm.activeView === view.id ? emptyFilters : p.crm.filters } }))}><X className="size-3" /></Button>
        </div>)}
      </div>
      <div className="ml-auto flex flex-wrap gap-2">
        <Popover><PopoverTrigger asChild><Button variant="outline" className="shadow-none"><SlidersHorizontal className="size-4" />View Settings</Button></PopoverTrigger>
          <PopoverContent className="w-60 rounded-xl border-neutral-200 bg-white shadow-none" align="end">
            <p className="mb-3 text-sm font-semibold">Visible columns</p>
            {crmColumns.map(column => <label key={column.id} className="flex items-center gap-2 rounded p-2 text-sm hover:bg-neutral-50">
              <Checkbox checked={!crm.hidden.includes(column.id)} onCheckedChange={checked => update(p => ({ ...p, crm: { ...p.crm, hidden: checked ? p.crm.hidden.filter(id => id !== column.id) : [...p.crm.hidden, column.id] } }))} />{column.label}
            </label>)}
          </PopoverContent>
        </Popover>
        <div className="flex rounded-xl border border-neutral-200" aria-label="CRM layout">
          {(["table", "pipeline"] as const).map(layout => <Button key={layout} variant="ghost" className="shadow-none hover:bg-neutral-50 aria-pressed:bg-neutral-100" aria-pressed={crm.layout === layout} onClick={() => update(p => ({ ...p, crm: { ...p.crm, layout } }))}>{layout === "table" ? <Rows3 className="size-4" /> : <LayoutGrid className="size-4" />}{layout === "table" ? "Table View" : "Board View"}</Button>)}
        </div>
        <Popover><PopoverTrigger asChild><Button variant="outline" className="shadow-none">Save view</Button></PopoverTrigger>
          <PopoverContent className="rounded-xl border-neutral-200 bg-white shadow-none" align="end">
            <form className="space-y-3" onSubmit={event => { event.preventDefault(); saveView() }}>
              <label className="space-y-1 text-sm">View name<Input value={name} onChange={event => setName(event.target.value)} placeholder="Target Sophomores" maxLength={60} /></label>
              <p className="text-xs text-neutral-500">Saves your current search, stage, and all applied filters. Changes to filters are temporary until saved.</p>
              {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
              <Button type="submit" className="shadow-none">Save as new view</Button>
            </form>
          </PopoverContent>
        </Popover>
      </div>
    </div>
    {storageError && <p role="status" className="text-xs text-amber-800">Browser storage is unavailable or was invalid. Changes remain available during this visit.</p>}
  </fieldset>
}
