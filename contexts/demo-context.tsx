"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

const STORAGE_KEY = "outclass-demo-mode"

interface DemoContextValue {
  /** Whether demo data is currently active. */
  isDemoEnabled: boolean
  /** Toggle demo mode on/off. Triggers a page reload to cleanly switch data sources. */
  toggleDemo: () => void
}

const DemoContext = createContext<DemoContextValue | null>(null)

/**
 * Checks whether demo mode is enabled.
 * Safe to call outside React (e.g. from lib/data.ts module scope).
 * Returns false during SSR.
 */
export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

export function DemoDataProvider({ children }: { children: ReactNode }) {
  const [isDemoEnabled, setIsDemoEnabled] = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    setIsDemoEnabled(isDemoMode())
  }, [])

  const toggleDemo = useCallback(() => {
    try {
      const next = !isDemoMode()
      if (next) {
        localStorage.setItem(STORAGE_KEY, "true")
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // Storage unavailable — toggle still works for this session
    }
    // Reload the page so all module-level data exports re-evaluate
    window.location.reload()
  }, [])

  return (
    <DemoContext.Provider value={{ isDemoEnabled, toggleDemo }}>
      {children}
    </DemoContext.Provider>
  )
}

export function useDemoMode() {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error("useDemoMode must be used within a DemoDataProvider")
  return ctx
}

