"use client"

import { useDemoMode } from "@/contexts/demo-context"
import { useCallback, useSyncExternalStore, type Dispatch, type SetStateAction } from "react"
import { z } from "zod"
import { applicants as seedApplicants, type Applicant } from "@/lib/data"
import { customizationSchema, defaultCustomization, type ClubCustomization } from "@/lib/club-customization-model"
export { crmColumns, emptyFilters, removeStage, matchesCRMFilters } from "@/lib/club-customization-model"
export type { ColumnId, CRMFilters, PublicProfile } from "@/lib/club-customization-model"

// Browser-local club customization, shared by every component on the page. It is a
// small store rather than a root-layout provider, so pages that never customize a
// club do not ship this module, its seed applicants or its schema.
type Snapshot = { clubs: Record<string, ClubCustomization>; ready: boolean; storageError: boolean }
type Store = { snapshot: Snapshot; listeners: Set<() => void>; loaded: boolean }
const serverSnapshot: Snapshot = { clubs: {}, ready: false, storageError: false }
const stores = new Map<string, Store>()

function storeFor(key: string): Store {
  let store = stores.get(key)
  if (!store) stores.set(key, store = { snapshot: serverSnapshot, listeners: new Set(), loaded: false })
  return store
}
function publish(store: Store, snapshot: Snapshot) {
  store.snapshot = snapshot
  store.listeners.forEach(listener => listener())
}
// Read once, after mount (first subscription), like the provider effect it replaces.
function load(key: string, store: Store) {
  if (store.loaded) return
  store.loaded = true
  let clubs: Record<string, ClubCustomization> = {}, storageError = false
  try { const raw = localStorage.getItem(key); if (raw) clubs = z.record(customizationSchema).parse(JSON.parse(raw)) }
  catch { storageError = true }
  publish(store, { clubs, ready: true, storageError })
}
function setClubs(key: string, action: SetStateAction<Record<string, ClubCustomization>>) {
  const store = storeFor(key)
  const clubs = typeof action === "function" ? action(store.snapshot.clubs) : action
  let storageError = store.snapshot.storageError
  try { localStorage.setItem(key, JSON.stringify(clubs)) } catch { storageError = true }
  publish(store, { ...store.snapshot, clubs, storageError })
}

export function useClubCustomization(clubId = "vvf") {
  const { isDemoEnabled } = useDemoMode()
  const storageKey = isDemoEnabled ? "outclass.demo.customization.v1" : "outclass.customization.v1"
  const store = storeFor(storageKey)
  const subscribe = useCallback((listener: () => void) => {
    const current = storeFor(storageKey)
    current.listeners.add(listener)
    load(storageKey, current)
    return () => { current.listeners.delete(listener) }
  }, [storageKey])
  const context = useSyncExternalStore(subscribe, () => store.snapshot, () => serverSnapshot)
  const { ready } = context
  const state = context.clubs[clubId] ?? defaultCustomization(clubId)
  function update(change: (previous: ClubCustomization) => ClubCustomization) {
    if (!ready) return
    setClubs(storageKey, previous => ({ ...previous, [clubId]: change(previous[clubId] ?? defaultCustomization(clubId)) }))
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
