"use client"

import type { ReactNode } from "react"
import { useAuth } from "@/contexts/auth-context"
import { OutClassLoadingScreen } from "@/components/outclass-loading-screen"

/** Only a known session awaiting its first identity blocks workspace entry. */
export function AuthSessionBoundary({ children }: { children: ReactNode }) {
  const { sessionPending } = useAuth()
  return sessionPending ? <OutClassLoadingScreen /> : children
}
