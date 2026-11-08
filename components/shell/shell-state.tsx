"use client"

import type { ReactNode } from "react"
import { ApplicationStateProvider } from "@/lib/application-state"
import { useInWorkspaceShell } from "@/components/shell/workspace-shell-context"

const empty = { applications: [], attendances: [] }

/**
 * Inside `app/(workspace)` the persistent shell owns the application store, so pages share it (one
 * notification poll, one inbox). Outside it (signed-out public frame) a page keeps a private empty store.
 */
export function ShellState({ children }: { children: ReactNode }) {
  if (useInWorkspaceShell()) return <>{children}</>
  return <ApplicationStateProvider initialData={empty} persistLocalState={false}>{children}</ApplicationStateProvider>
}
