import { z } from "zod"
import { cookies } from "next/headers"
import { DEMO_COOKIE } from "@/lib/demo/access"
import { getClubWorkspaceOverview, getWorkspaceRounds } from "@/actions/club-overview"
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
const noArgs = z.tuple([])

// An explicit read allowlist. Each private loader still runs its original live
// authentication/authorization; no client identity or arbitrary action dispatch.
export async function GET(request: Request) {
  try {
    // Invitation discovery can bind a verified school identity. Keep all live
    // readers disabled in demo even when middleware is bypassed or a stale
    // support cookie is present; demo adapters never use this endpoint.
    if ((await cookies()).get(DEMO_COOKIE)?.value === "1") return Response.json({ error: "Live workspace reads are unavailable in Demo Mode" }, { status: 403, headers })
    const params = new URL(request.url).searchParams
    const args: unknown = JSON.parse(params.get("args") || "[]")
    let data: unknown
    switch (params.get("kind")) {
      case "overview": data = await getClubWorkspaceOverview(...clubArgs.parse(args)); break
      case "members": data = await getOrganizationMemberManagement(...clubArgs.parse(args)); break
      case "pipeline": data = await getClubPipeline(...clubArgs.parse(args)); break
      case "rounds": data = await getWorkspaceRounds(...clubArgs.parse(args)); break
      case "applicationSettings": data = await getApplicationSettings(...clubArgs.parse(args)); break
      case "pipelineSettings": data = await getPipelineSettings(...clubArgs.parse(args)); break
      case "directory": noArgs.parse(args); data = await getClubDirectory(); break
      case "publicClub": data = await getPublicClub(...z.tuple([z.string().min(1).max(200)]).parse(args)); break
      case "corkboard": noArgs.parse(args); data = await getCorkboard(); break
      case "taskNotifications": noArgs.parse(args); data = await getTaskNotifications(); break
      case "studentDashboard": noArgs.parse(args); data = await getStudentDashboardData(); break
      case "invitations": data = await getOrganizationInvitations(...z.tuple([z.boolean()]).parse(args)); break
      case "tutorial": data = await getTutorial(...z.tuple([z.enum(["student", "leader"]), z.string().uuid().nullish().transform(value => value ?? undefined)]).parse(args)); break
      case "applicantDisplay": data = await getApplicantDisplay(...z.tuple([z.object({ clubId: z.string().uuid(), applicationId: z.string().uuid(), sessionId: z.string().uuid().optional(), previewConfig: z.unknown().optional() }).strict()]).parse(args) as Parameters<typeof getApplicantDisplay>); break
      case "attendance": data = await recruitmentAttendanceSummary(...z.tuple([z.string().uuid(), z.string().uuid()]).parse(args)); break
      default: return Response.json({ error: "Unknown workspace read" }, { status: 400, headers })
    }
    return Response.json(encodeWorkspaceData(data), { headers })
  } catch (error) {
    const redirect = error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")
    const invalid = error instanceof z.ZodError || error instanceof SyntaxError
    return Response.json({ error: invalid ? "Invalid workspace read" : "Workspace access unavailable" }, { status: invalid ? 400 : redirect ? 401 : 403, headers })
  }
}
