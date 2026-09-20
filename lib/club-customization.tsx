"use client"

import { createContext, useContext, useEffect, useState, type Dispatch, type SetStateAction, type ReactNode } from "react"
import { z } from "zod"
import { applicants as seedApplicants, type Applicant } from "@/lib/data"

export const crmColumns = [
  { id: "selection", label: "Selection" }, { id: "name", label: "Applicant" },
  { id: "year", label: "Year" }, { id: "major", label: "Major" },
  { id: "gpa", label: "GPA" }, { id: "satScore", label: "SAT Score" },
  { id: "status", label: "Stage" }, { id: "score", label: "Avg Score" },
  { id: "events", label: "Events Attended" },
] as const
export type ColumnId = typeof crmColumns[number]["id"]
const filtersSchema = z.object({ query: z.string(), stage: z.string(), majors: z.array(z.string()), years: z.array(z.string()), minGpa: z.number().min(0).max(4).nullable(), minSat: z.number().min(0).max(1600).nullable() })
export type CRMFilters = z.infer<typeof filtersSchema>
export const emptyFilters: CRMFilters = { query: "", stage: "All Stages", majors: [], years: [], minGpa: null, minSat: null }
const profileSchema = z.object({ name: z.string(), tagline: z.string(), about: z.string(), accent: z.string().regex(/^#[0-9a-f]{6}$/i), acceptance: z.string(), aum: z.string(), placements: z.string(), showAcceptance: z.boolean(), showAum: z.boolean(), showPlacements: z.boolean(), showDirectory: z.boolean() })
export type PublicProfile = z.infer<typeof profileSchema>
const schema = z.object({
  stages: z.array(z.object({ id: z.string().min(1), name: z.string().trim().min(1) })).min(1).refine(stages => new Set(stages.map(s => s.id)).size === stages.length && stages.every(s => !["Accepted", "Rejected", "All Stages"].includes(s.id))),
  positions: z.record(z.string()),
  crm: z.object({ hidden: z.array(z.enum(["selection", "name", "year", "major", "gpa", "satScore", "status", "score", "events"])), layout: z.enum(["table", "pipeline"]), filters: filtersSchema, activeView: z.string(), views: z.array(z.object({ id: z.string(), name: z.string(), filters: filtersSchema })) }),
  profile: profileSchema,
})
export type ClubCustomization = z.infer<typeof schema>
export function defaultCustomization(clubId: string): ClubCustomization {
  return { stages: [{ id: "Applied", name: "Applied" }, { id: "Round 1", name: "Round 1" }, { id: "Round 2", name: "Round 2" }], positions: {},
    crm: { hidden: [], layout: "table", filters: emptyFilters, activeView: "all", views: [] },
    profile: { name: clubId === "vvf" ? "Virginia Venture Fund" : "Your club", tagline: "Explore venture capital with our community.", about: "A student-led community learning to invest, build, and make an impact.", accent: "#051B3D", acceptance: "8%", aum: "$100,000", placements: "", showAcceptance: true, showAum: true, showPlacements: true, showDirectory: false },
  }
}
export function removeStage(state: ClubCustomization, id: string): ClubCustomization {
  const stages = state.stages.filter(stage => stage.id !== id)
  if (!stages.length || stages.length === state.stages.length) return state
  const positions = { ...state.positions }
  seedApplicants.forEach(applicant => { if ((positions[applicant.id] ?? applicant.status) === id) positions[applicant.id] = stages[0].id })
  Object.keys(positions).forEach(key => { if (positions[key] === id) positions[key] = stages[0].id })
  const clean = (filters: CRMFilters) => filters.stage === id ? { ...filters, stage: "All Stages" } : filters
  return { ...state, stages, positions, crm: { ...state.crm, filters: clean(state.crm.filters), views: state.crm.views.map(view => ({ ...view, filters: clean(view.filters) })) } }
}
const Context = createContext<{ clubs: Record<string, ClubCustomization>; setClubs: Dispatch<SetStateAction<Record<string, ClubCustomization>>>; ready: boolean; storageError: boolean } | null>(null)
const storageKey = "outclass.customization.v1"
export function ClubCustomizationProvider({ children }: { children: ReactNode }) {
  const [clubs, setClubs] = useState<Record<string, ClubCustomization>>({})
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState(false)
  useEffect(() => {
    try { const raw = localStorage.getItem(storageKey); if (raw) setClubs(z.record(schema).parse(JSON.parse(raw))) }
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
    if (!context!.ready) return
    context!.setClubs(previous => ({ ...previous, [clubId]: change(previous[clubId] ?? defaultCustomization(clubId)) }))
  }
  const stages = [...state.stages, { id: "Accepted", name: "Accepted" }, { id: "Rejected", name: "Rejected" }]
  function stageName(id: string) { return stages.find(stage => stage.id === id)?.name ?? id }
  const applicants = seedApplicants.map(applicant => ({ ...applicant, status: state.positions[applicant.id] ?? (stages.some(s => s.id === applicant.status) ? applicant.status : state.stages[0].id) }))
  const setApplicants: Dispatch<SetStateAction<Applicant[]>> = action => update(previous => {
    const current = seedApplicants.map(applicant => ({ ...applicant, status: previous.positions[applicant.id] ?? (stages.some(s => s.id === applicant.status) ? applicant.status : previous.stages[0].id) }))
    const next = typeof action === "function" ? action(current) : action
    return { ...previous, positions: Object.fromEntries(next.map(applicant => [applicant.id, applicant.status])) }
  })
  return { state, update, stages, stageName, applicants, setApplicants, ready: context.ready, storageError: context.storageError }
}
