"use server"
import { z } from "zod"
import { requireClubPermission } from "@/utils/auth"
import { requirePlatformAdmin } from "@/utils/platform-admin"
import { ActionError } from "@/lib/action-result"
import { adminActionResult } from "@/lib/admin-failure"
import { boundedParse } from "@/lib/bounded-input"
import { limitAction } from "@/lib/rate-limit-action"
import { RATE_LIMIT_MESSAGE, RATE_LIMITS } from "@/lib/rate-limit"
import { importClubWebsite } from "@/lib/club-website-import/import"

const importInput = z.object({ url: z.string().trim().min(1).max(2000), clubId: z.string().uuid().optional() }).strict()

async function importClubFromWebsiteCommand(input: unknown) {
  const data = boundedParse(importInput, input)
  // Leaders import into their own club's editor; platform admins import while creating or editing any club.
  const actor = data.clubId ? (await requireClubPermission(data.clubId, ["club.settings"])).user : await requirePlatformAdmin()
  if (!(await limitAction(RATE_LIMITS.clubWebsiteImport, { userId: actor.id })).ok) throw new ActionError(RATE_LIMIT_MESSAGE, "RATE_LIMITED")
  return importClubWebsite(data.url)
}

/** Reads a club's public website into suggested profile values. Saves nothing. */
export async function importClubFromWebsite(input: { url: string; clubId?: string }) {
  return adminActionResult(() => importClubFromWebsiteCommand(input), "importClubFromWebsite")
}
