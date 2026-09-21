"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { removeStage, useClubCustomization } from "@/lib/club-customization"

export function RecruitmentPipelineBuilder({ clubId = "vvf" }: { clubId?: string }) {
  const { state, update, ready } = useClubCustomization(clubId)
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  function valid(value: string, id?: string) {
    return value.trim() && !["accepted", "rejected", "all stages", ...state.stages.filter(s => s.id !== id).map(s => s.name.toLowerCase())].includes(value.trim().toLowerCase())
  }
  function move(index: number, offset: number) {
    update(previous => { const stages = [...previous.stages]; [stages[index], stages[index + offset]] = [stages[index + offset], stages[index]]; return { ...previous, stages } })
  }
  return <fieldset disabled={!ready} className="space-y-5 rounded-xl border border-neutral-200 bg-white p-6 font-sans">
    <div><h2 className="text-lg font-semibold">Recruitment Pipeline</h2><p className="mt-1 text-sm text-neutral-500">Define your process. Applicants can move directly to any stage in the CRM.</p></div>
    <ol className="space-y-2">{state.stages.map((stage, index) => <li key={stage.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 p-3">
      <span className="w-6 text-sm text-neutral-400">{index + 1}</span>
      <Input aria-label={`Stage ${index + 1} name`} className="min-w-32 flex-1 shadow-none" defaultValue={stage.name} maxLength={60} onBlur={event => {
        const value = event.target.value.trim()
        if (!valid(value, stage.id)) { event.target.value = stage.name; setError("Stage names must be nonempty and unique. Accepted and Rejected are reserved."); return }
        update(p => ({ ...p, stages: p.stages.map(s => s.id === stage.id ? { ...s, name: value } : s) })); setError("")
      }} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur() }} />
      <Button variant="ghost" size="icon" disabled={index === 0} aria-label={`Move ${stage.name} up`} onClick={() => move(index, -1)}><ArrowUp className="size-4" /></Button>
      <Button variant="ghost" size="icon" disabled={index === state.stages.length - 1} aria-label={`Move ${stage.name} down`} onClick={() => move(index, 1)}><ArrowDown className="size-4" /></Button>
      <Button variant="ghost" size="icon" disabled={state.stages.length === 1} aria-label={`Delete ${stage.name}`} onClick={() => update(p => removeStage(p, stage.id))}><Trash2 className="size-4" /></Button>
    </li>)}</ol>
    <p className="text-xs text-neutral-500">Deleting a stage moves its applicants to the first remaining stage and clears saved filters for that stage. Accepted and Rejected remain available as outcomes.</p>
    <form className="flex gap-2" onSubmit={event => {
      event.preventDefault()
      if (!valid(name)) { setError("Enter a unique stage name."); return }
      update(p => ({ ...p, stages: [...p.stages, { id: crypto.randomUUID(), name: name.trim() }] })); setName(""); setError("")
    }}><Input aria-label="New stage name" placeholder="e.g. Coffee Chats" value={name} maxLength={60} onChange={event => setName(event.target.value)} /><Button type="submit" variant="outline" className="shadow-none"><Plus className="size-4" />Add stage</Button></form>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <p className="text-xs text-neutral-500">Saved automatically in this browser.</p>
  </fieldset>
}
