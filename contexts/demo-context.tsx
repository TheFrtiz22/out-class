"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { isDemoMode, DEMO_STORAGE_KEY } from "@/lib/demo-utils"
import { applyDemoData } from "@/lib/data"

interface DemoContextValue {
  /** Whether demo data is currently active. */
  isDemoEnabled: boolean
  /** Toggle demo mode on/off. Flushes state and remounts data without hard reload. */
  toggleDemo: () => void
}

const DemoContext = createContext<DemoContextValue | null>(null)

export function DemoDataProvider({ children }: { children: ReactNode }) {
  const [isDemoEnabled, setIsDemoEnabled] = useState(false)
  const [appKey, setAppKey] = useState(0)
  const router = useRouter()

  // Hydrate from localStorage on mount
  useEffect(() => {
    setIsDemoEnabled(isDemoMode())
  }, [])

  const toggleDemo = useCallback(() => {
    try {
      const next = !isDemoEnabled
      if (next) {
        localStorage.setItem(DEMO_STORAGE_KEY, "true")
      } else {
        localStorage.removeItem(DEMO_STORAGE_KEY)
      }
      
      // Update the module-level data arrays in place
      applyDemoData(next)
      
      setIsDemoEnabled(next)
      
      // Force all client components to unmount and remount with fresh state
      setAppKey(Date.now())
      
      // Re-fetch Server Components to ensure server data matches
      router.refresh()
    } catch {
      // Storage unavailable
    }
  }, [isDemoEnabled, router])

  return (
    <DemoContext.Provider value={{ isDemoEnabled, toggleDemo }}>
      <div key={appKey} style={{ display: 'contents' }}>
        {children}
      </div>
    </DemoContext.Provider>
  )
}

export function useDemoMode() {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error("useDemoMode must be used within a DemoDataProvider")
  return ctx
}

