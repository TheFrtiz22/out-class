"use client"
import { decodeWorkspaceData, type WorkspaceWire } from "@/lib/workspace-wire"
import type * as members from "@/actions/organization-members"
import type * as onboarding from "@/actions/club-onboarding"
import type * as settings from "@/actions/club-settings"

export async function readWorkspace<T>(kind: string, args: unknown[] = []): Promise<T> {
  const query = new URLSearchParams({ kind, args: JSON.stringify(args) })
  const response = await fetch(`/api/workspace?${query}`, { cache: "no-store", credentials: "same-origin" })
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "Your access changed. Reload to check your current permissions." : "Could not load this workspace. Try again.")
  return decodeWorkspaceData<T>(await response.json() as WorkspaceWire)
}
export const getOrganizationMemberManagement = (clubId: string) => readWorkspace<Awaited<ReturnType<typeof members.getOrganizationMemberManagement>>>("members", [clubId])
export const getOrganizationInvitations = (includeDismissed = false) => readWorkspace<Awaited<ReturnType<typeof onboarding.getOrganizationInvitations>>>("invitations", [includeDismissed])
export const getApplicationSettings = (clubId: string) => readWorkspace<Awaited<ReturnType<typeof settings.getApplicationSettings>>>("applicationSettings", [clubId])
export const getPipelineSettings = (clubId: string) => readWorkspace<Awaited<ReturnType<typeof settings.getPipelineSettings>>>("pipelineSettings", [clubId])
