import { z } from "zod"
import { applicants as seedApplicants, type Applicant } from "./data"

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
export const customizationSchema = z.object({
  stages: z.array(z.object({ id: z.string().min(1), name: z.string().trim().min(1) })).min(1).refine(stages => new Set(stages.map(s => s.id)).size === stages.length && new Set(stages.map(s => s.name.toLowerCase())).size === stages.length && stages.every(s => !["Accepted", "Rejected", "All Stages"].includes(s.id) && !["accepted", "rejected", "all stages"].includes(s.name.toLowerCase()))),
  positions: z.record(z.string()),
  crm: z.object({ hidden: z.array(z.enum(["selection", "name", "year", "major", "gpa", "satScore", "status", "score", "events"])), layout: z.enum(["table", "pipeline"]), filters: filtersSchema, activeView: z.string(), views: z.array(z.object({ id: z.string(), name: z.string(), filters: filtersSchema })) }),
  profile: profileSchema,
})
export type ClubCustomization = z.infer<typeof customizationSchema>
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

export function matchesCRMFilters(applicant: Applicant, filters: CRMFilters) {
  const query = filters.query.toLowerCase()
  return (filters.stage === "All Stages" || applicant.status === filters.stage)
    && (applicant.name.toLowerCase().includes(query) || applicant.email.toLowerCase().includes(query))
    && (!filters.majors.length || filters.majors.includes(applicant.major))
    && (!filters.years.length || filters.years.includes(applicant.year))
    && (filters.minSat === null || applicant.satScore > filters.minSat)
    && (filters.minGpa === null || Number(applicant.gpa) > filters.minGpa)
}
