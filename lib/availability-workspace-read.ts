"use client"
import { readWorkspace } from "@/lib/workspace-read"
import type * as availability from "@/actions/availability"
import type * as panels from "@/actions/panel-proposals"
export const getMyAvailability = () => readWorkspace<Awaited<ReturnType<typeof availability.getMyAvailability>>>("myAvailability")
export const getMyRoundAvailability = (scope: Parameters<typeof availability.getMyRoundAvailability>[0]) => readWorkspace<Awaited<ReturnType<typeof availability.getMyRoundAvailability>>>("roundAvailability", [scope])
export const getAvailabilityOverview = (scope: Parameters<typeof availability.getAvailabilityOverview>[0]) => readWorkspace<Awaited<ReturnType<typeof availability.getAvailabilityOverview>>>("availabilityOverview", [scope])
export const getRoundStaffingCoverage = (scope: Parameters<typeof availability.getRoundStaffingCoverage>[0]) => readWorkspace<Awaited<ReturnType<typeof availability.getRoundStaffingCoverage>>>("staffingCoverage", [scope])
export const getPanelProposalWorkspace = (scope: Parameters<typeof panels.getPanelProposalWorkspace>[0]) => readWorkspace<Awaited<ReturnType<typeof panels.getPanelProposalWorkspace>>>("panelWorkspace", [scope])
