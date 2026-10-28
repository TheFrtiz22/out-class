import { workspaceJsonResponse } from "@/lib/workspace-response"
import { serverPhase, traceWorkspaceRequest } from "@/lib/server-phase-trace"
import { UniversityVerificationError } from "@/utils/verified-email-policy"
import { getVotingWorkspace, getVotingJoinInfo } from "@/actions/voting"
import { genderValues } from "@/lib/student-profile"
import { z } from "zod"
import { cookies } from "next/headers"
import { DEMO_COOKIE } from "@/lib/demo/access"
import { getDashboardReviewQueue, getClubWorkspaceOverview, getWorkspaceRounds } from "@/actions/club-overview"
import { getClubPipeline } from "@/actions/crm"
import { getOrganizationMemberManagement } from "@/actions/organization-members"
import { getOrganizationInvitations } from "@/actions/club-onboarding"
import { getClubDirectory, getPublicClub, getCorkboard } from "@/actions/club-directory"
import { getTaskNotifications } from "@/actions/tasks"
import { getTutorial } from "@/actions/tutorials"
import { getApplicationSettings, getPipelineSettings } from "@/actions/club-settings"
import { getApplicantDisplay } from "@/actions/applicant-intelligence"
import { recruitmentAttendanceSummary } from "@/actions/meetings"
import { getStudentDashboardData } from "@/actions/applications"
import { encodeWorkspaceData } from "@/lib/workspace-wire"

export const dynamic = "force-dynamic"
export const maxDuration = 60
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" }
const clubArgs = z.tuple([z.string().uuid()])
const taskArgs = z.union([clubArgs, z.tuple([z.string().uuid(), z.object({ taskId: z.string().uuid(), assignmentId: z.string().uuid().optional() }).strict()])])
const noArgs = z.tuple([])
// JSON serializes an explicit undefined optional argument as null.
const votingArgs = z.preprocess(args => Array.isArray(args) && args.length === 1 ? [args[0], null] : args,
  z.tuple([z.string().uuid(), z.string().uuid().nullish().transform(value => value ?? undefined)]))

// An explicit read allowlist. Each private loader still runs its original live
// authentication/authorization; no client identity or arbitrary action dispatch.
export async function GET(request: Request) {
  return traceWorkspaceRequest(async () => {
  try {
    // Invitation discovery can bind a verified school identity. Keep all live
    // readers disabled in demo even when middleware is bypassed or a stale
    // support cookie is present; demo adapters never use this endpoint.
    if ((await cookies()).get(DEMO_COOKIE)?.value === "1") return Response.json({ error: "Live workspace reads are unavailable in Demo Mode" }, { status: 403, headers })
    const params = new URL(request.url).searchParams
    const args: unknown = JSON.parse(params.get("args") || "[]")
    let data: unknown
    switch (params.get("kind")) {
      case "myAvailability": noArgs.parse(args); data = await (await import("@/actions/availability")).getMyAvailability(); break
      case "roundAvailability": data = await (await import("@/actions/availability")).getMyRoundAvailability(z.tuple([z.unknown()]).parse(args)[0]); break
      case "availabilityOverview": data = await (await import("@/actions/availability")).getAvailabilityOverview(z.tuple([z.unknown()]).parse(args)[0]); break
      case "staffingCoverage": data = await (await import("@/actions/availability")).getRoundStaffingCoverage(z.tuple([z.unknown()]).parse(args)[0]); break
      case "panelWorkspace": data = await (await import("@/actions/panel-proposals")).getPanelProposalWorkspace(z.tuple([z.unknown()]).parse(args)[0]); break
      case "assignedRooms": data = await (await import("@/actions/interview-entry")).getAssignedInterviewRooms(...clubArgs.parse(args)); break
      case "interviewWorkspace": data = await (await import("@/actions/interview-kits")).getInterviewWorkspace(...clubArgs.parse(args)); break
      case "interviewRounds": data = await (await import("@/actions/interview-kits")).getInterviewRounds(...clubArgs.parse(args)); break
      case "roomWorkspace": data = await (await import("@/actions/interview-rooms")).getRoomWorkspace(...clubArgs.parse(args)); break
      case "bookingPublication": data = await (await import("@/actions/interview-booking-publication")).getInterviewBookingPublication(...z.tuple([z.object({ clubId: z.string().uuid(), roundId: z.string().uuid() }).strict()]).parse(args)); break
      case "tasks": data = await (await import("@/actions/tasks")).getTaskWorkspace(...taskArgs.parse(args)); break
      case "meetings": data = await (await import("@/actions/meetings")).listMeetings(...z.tuple([z.string().uuid().nullish().transform(value => value ?? undefined)]).parse(Array.isArray(args) && args.length === 0 ? [null] : args)); break
      case "announcements": data = await (await import("@/actions/communications")).getClubAnnouncements(...clubArgs.parse(args)); break
      case "notifications": data = await (await import("@/actions/communications")).getDurableNotifications(...z.tuple([z.string().uuid().nullish().transform(value => value ?? undefined)]).parse(Array.isArray(args) && args.length === 0 ? [null] : args)); break
      case "dashboardReviews": data = await getDashboardReviewQueue(...z.tuple([z.string().uuid(), z.string().uuid()]).parse(args)); break
      case "overview": data = await getClubWorkspaceOverview(...clubArgs.parse(args)); break
      case "members": data = await getOrganizationMemberManagement(...clubArgs.parse(args)); break
      case "pipeline": data = await getClubPipeline(...z.tuple([z.string().uuid(), z.object({ applicationId: z.string().uuid().optional(), roundId: z.string().uuid().optional(), gender: z.enum(genderValues).optional(), genderCounts: z.boolean().optional() }).strict().optional()]).parse(args)); break
      case "rounds": data = await getWorkspaceRounds(...clubArgs.parse(args)); break
      case "applicationSettings": data = await getApplicationSettings(...clubArgs.parse(args)); break
      case "pipelineSettings": data = await getPipelineSettings(...clubArgs.parse(args)); break
      case "directory": noArgs.parse(args); data = await getClubDirectory(); break
      case "publicClub": data = await getPublicClub(...z.tuple([z.string().min(1).max(200)]).parse(args)); break
      case "corkboard": noArgs.parse(args); data = await getCorkboard(); break
      case "taskNotifications": noArgs.parse(args); data = await getTaskNotifications(); break
      case "studentDashboard": noArgs.parse(args); data = await getStudentDashboardData(); break
      case "voting": data = await getVotingWorkspace(...votingArgs.parse(args)); break
      case "votingJoin": data = await getVotingJoinInfo(...clubArgs.parse(args)); break
      case "invitations": data = await getOrganizationInvitations(...z.tuple([z.boolean()]).parse(args)); break
      case "tutorial": data = await getTutorial(...z.tuple([z.enum(["student", "leader"]), z.string().uuid().nullish().transform(value => value ?? undefined)]).parse(args)); break
      case "applicantDisplay": data = await getApplicantDisplay(...z.tuple([z.object({ clubId: z.string().uuid(), applicationId: z.string().uuid(), sessionId: z.string().uuid().optional(), previewConfig: z.unknown().optional() }).strict()]).parse(args) as Parameters<typeof getApplicantDisplay>); break
      case "attendance": data = await recruitmentAttendanceSummary(...z.tuple([z.string().uuid(), z.string().uuid()]).parse(args)); break
      default: return Response.json({ error: "Unknown workspace read" }, { status: 400, headers })
    }
    return await serverPhase("serialization", () => workspaceJsonResponse(encodeWorkspaceData(data), request, headers))
  } catch (error) {
    if (error instanceof UniversityVerificationError) return Response.json({ error: error.code }, { status: error.code === "UNIVERSITY_VERIFICATION_REQUIRED" ? 403 : 503, headers })
    const redirect = error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")
    const invalid = error instanceof z.ZodError || error instanceof SyntaxError
    return Response.json({ error: invalid ? "Invalid workspace read" : "Workspace access unavailable" }, { status: invalid ? 400 : redirect ? 401 : 403, headers })
  }
  })
}
