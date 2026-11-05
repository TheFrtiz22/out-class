"use client"
import { createContext, useContext } from "react"
import type { DemoState } from "@/lib/demo/seed"

// The context object and hook live apart from DemoDataProvider so lightweight
// pages (e.g. QR check-in) can read the demo flag without bundling the demo
// store and seed data, which only the provider needs.
export type DemoContextValue = {
  isDemoEnabled: boolean
  allowed: boolean
  ready: boolean
  state: DemoState | null
  toggleDemo: () => Promise<void>
  resetDemo: () => void
  viewAs: (role: "student" | "leader", clubId?: string) => void
  error: string
}
export const DemoContext = createContext<DemoContextValue | null>(null)
export function useDemoMode() {
  const value = useContext(DemoContext)
  if (!value) throw new Error("DemoDataProvider is required")
  return value
}
