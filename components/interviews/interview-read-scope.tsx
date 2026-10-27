"use client"
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { inFlightWorkspaceReads } from "@/lib/in-flight-workspace-reads"
import { getAssignedInterviewRooms } from "@/lib/workspace-api"

const Context = createContext<ReturnType<typeof inFlightWorkspaceReads> | null>(null)
const changes = ["outclass:panels-changed", "outclass:interview-rounds-changed", "outclass:demo-change"]
export function InterviewReadScope({ clubId, children }: { clubId: string; children: ReactNode }) {
  const { user, isImpersonating, readAuthority } = useAuth(), demo = useDemoMode()
  // The whole identity snapshot includes membership/capabilities, interview grants,
  // suspension and privacy versions. Support entry/exit refreshes that snapshot.
  // Auth token changes rotate the opaque epoch. This owner never outlives the UI.
  const reads = useMemo(inFlightWorkspaceReads, [user, isImpersonating, readAuthority, clubId, demo.isDemoEnabled])
  useEffect(() => {
    const invalidate = () => reads.invalidate()
    // Fence pre-command snapshots before child refresh listeners dispatch.
    changes.forEach(name => window.addEventListener(name, invalidate, true))
    return () => { reads.invalidate(); changes.forEach(name => window.removeEventListener(name, invalidate, true)) }
  }, [reads])
  return <Context.Provider value={reads}>{children}</Context.Provider>
}
export function useAssignedInterviewRooms(clubId: string) {
  const reads = useContext(Context)
  return useCallback(() => reads ? reads.read(`assigned:${clubId}`, () => getAssignedInterviewRooms(clubId)) : getAssignedInterviewRooms(clubId), [reads, clubId])
}
