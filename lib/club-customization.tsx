"use client"

import { createContext, useContext, useEffect, useState, type Dispatch, type SetStateAction, type ReactNode } from "react"
import { z } from "zod"
import { applicants as seedApplicants, type Applicant } from "@/lib/data"
import { customizationSchema, defaultCustomization, type ClubCustomization } from "@/lib/club-customization-model"
export { crmColumns, emptyFilters, removeStage, matchesCRMFilters } from "@/lib/club-customization-model"
export type { ColumnId, CRMFilters, PublicProfile } from "@/lib/club-customization-model"

const Context = createContext<{ clubs: Record<string, ClubCustomization>; setClubs: Dispatch<SetStateAction<Record<string, ClubCustomization>>>; ready: boolean; storageError: boolean } | null>(null)
const storageKey = "outclass.customization.v1"
export function ClubCustomizationProvider({ children }: { children: ReactNode }) {
  const [clubs, setClubs] = useState<Record<string, ClubCustomization>>({})
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState(false)
  useEffect(() => {
    try { const raw = localStorage.getItem(storageKey); if (raw) setClubs(z.record(customizationSchema).parse(JSON.parse(raw))) }
    catch { setStorageError(true) }
    setReady(true)
  }, [])
  useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(storageKey, JSON.stringify(clubs)) } catch { setStorageError(true) }
  }, [clubs, ready])
  return <Context.Provider value={{ clubs, setClubs, ready, storageError }}>{children}</Context.Provider>
}
export function useClubCustomization(clubId = "vvf") {
  const context = useContext(Context)
  if (!context) throw new Error("ClubCustomizationProvider is required")
  const state = context.clubs[clubId] ?? defaultCustomization(clubId)
  function update(change: (previous: ClubCustomization) => ClubCustomization) {
    if (!context.ready) return
    context.setClubs(previous => ({ ...previous, [clubId]: change(previous[clubId] ?? defaultCustomization(clubId)) }))
  }
  const stages = [...state.stages, { id: "Accepted", name: "Accepted" }, { id: "Rejected", name: "Rejected" }]
  function stageName(id: string) { return stages.find(stage => stage.id === id)?.name ?? id }
  const applicants = seedApplicants.map(applicant => ({ ...applicant, status: state.positions[applicant.id] ?? (stages.some(s => s.id === applicant.status) ? applicant.status : state.stages[0].id) }))
  const setApplicants: Dispatch<SetStateAction<Applicant[]>> = action => update(previous => {
    const current = seedApplicants.map(applicant => ({ ...applicant, status: previous.positions[applicant.id] ?? ([...previous.stages.map(stage => stage.id), "Accepted", "Rejected"].includes(applicant.status) ? applicant.status : previous.stages[0].id) }))
    const next = typeof action === "function" ? action(current) : action
    return { ...previous, positions: Object.fromEntries(next.map(applicant => [applicant.id, applicant.status])) }
  })
  return { state, configured: !!context.clubs[clubId], update, stages, stageName, applicants, setApplicants, ready: context.ready, storageError: context.storageError }
}
