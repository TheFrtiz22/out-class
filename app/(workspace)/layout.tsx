import type { ReactNode } from "react"
import { PublicPageFrame } from "@/components/landing/public-page-frame"
import { WorkspaceShell } from "@/components/shell/workspace-shell"
import { workspaceFrame } from "@/components/shell/workspace-frame"
import { MaintenanceGate } from "@/components/maintenance-gate"

/**
 * Every signed-in workspace route (Personal, club workspaces, Admin, settings, meetings, …) shares
 * this layout, so the header, workspace pill, utilities, rail and bottom bar mount once and persist
 * across workspace switches. Route groups do not change URLs. Pages render only their content and
 * keep their own server authorization; the shell reads the active workspace from the URL.
 * No loading.tsx here: a group-level boundary would stream 200s for pages that call notFound().
 */
export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  // Maintenance mode replaces the signed-in shell for non-admins; /platform stays usable for admins.
  return await workspaceFrame() === "shell" ? <MaintenanceGate><WorkspaceShell>{children}</WorkspaceShell></MaintenanceGate> : <PublicPageFrame>{children}</PublicPageFrame>
}
