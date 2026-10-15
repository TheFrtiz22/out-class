import { z } from "zod"
import type { ClubPermission } from "@/lib/permissions"
export const draftKinds = ["club-profile", "application-builder", "pipeline", "announcement", "task", "event", "decision-templates", "profile", "meeting", "task-feedback", "task-submission", "review"] as const
export const editorScopeSchema = z.object({ kind: z.enum(draftKinds), clubId: z.string().uuid().optional(), resourceId: z.string().max(180).default("main") })
export type EditorScope = z.input<typeof editorScopeSchema>
export const draftPermissions: Record<Exclude<EditorScope["kind"], "profile" | "task-submission">, ClubPermission> = {
  meeting: "meetings.manage", "task-feedback": "tasks.manage", review: "applications.review",
  "club-profile": "club.settings", "application-builder": "application.manage", pipeline: "recruitment.manage",
  announcement: "meetings.manage", task: "tasks.manage", event: "meetings.manage", "decision-templates": "recruitment.manage",
}
export function editorDraftKey(scope: z.output<typeof editorScopeSchema>) { return `${scope.kind}:${scope.clubId || "self"}:${scope.resourceId}` }
export const editorSaveSchema = z.object({ scope: editorScopeSchema, revision: z.number().int().nonnegative(), mutationId: z.string().uuid(), base: z.string().max(300000), content: z.unknown().refine(v => v === null || v !== undefined && JSON.stringify(v).length <= 300000, "Draft is too large.") })
