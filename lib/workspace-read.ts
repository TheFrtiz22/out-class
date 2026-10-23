"use client"
import { workspaceReadQueue } from "@/lib/workspace-read-queue"
import type * as communications from "@/actions/communications"
import { decodeWorkspaceData, type WorkspaceWire } from "@/lib/workspace-wire"
import type * as members from "@/actions/organization-members"
import type * as onboarding from "@/actions/club-onboarding"
import type * as settings from "@/actions/club-settings"

const dispatch = workspaceReadQueue(3, 24)

export async function readWorkspace<T>(kind: string, args: unknown[] = []): Promise<T> {
  const query = new URLSearchParams({ kind, args: JSON.stringify(args) })
  const controller = new AbortController()
  // Reads are safe to retry explicitly; never leave a disconnected view pending indefinitely.
  const deadline = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await dispatch(() => fetch(`/api/workspace?${query}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal }), controller.signal)
    if (!response.ok) {
      if (kind === "invitations") {
        const body = await response.json().catch(() => null) as { error?: string } | null
        if (body?.error === "UNIVERSITY_VERIFICATION_REQUIRED") throw new Error("Verify your university email through the normal email verification or password recovery flow before responding to invitations.")
        if (body?.error === "UNIVERSITY_VERIFICATION_UNAVAILABLE") throw new Error("University email verification is temporarily unavailable. Try again later.")
      }
      throw new Error(response.status === 401 || response.status === 403 ? "Your access changed. Reload to check your current permissions." : "Could not load this workspace. Try again.")
    }
    return decodeWorkspaceData<T>(await response.json() as WorkspaceWire)
  } catch (error) {
    if (controller.signal.aborted) throw new Error("This workspace took too long to load. Please try again.")
    throw error
  } finally {
    clearTimeout(deadline)
  }
}
export const getOrganizationMemberManagement = (clubId: string) => readWorkspace<Awaited<ReturnType<typeof members.getOrganizationMemberManagement>>>("members", [clubId])
export const getOrganizationInvitations = (includeDismissed = false) => readWorkspace<Awaited<ReturnType<typeof onboarding.getOrganizationInvitations>>>("invitations", [includeDismissed])
export const getApplicationSettings = (clubId: string) => readWorkspace<Awaited<ReturnType<typeof settings.getApplicationSettings>>>("applicationSettings", [clubId])
export const getPipelineSettings = (clubId: string) => readWorkspace<Awaited<ReturnType<typeof settings.getPipelineSettings>>>("pipelineSettings", [clubId])

export const getClubAnnouncements = (clubId: string) => readWorkspace<Awaited<ReturnType<typeof communications.getClubAnnouncements>>>("announcements", [clubId])
export const getDurableNotifications = (cursor?: string) => readWorkspace<Awaited<ReturnType<typeof communications.getDurableNotifications>>>("notifications", [cursor])
