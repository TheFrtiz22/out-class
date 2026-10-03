import { z } from "zod"
import type { DirectoryClub } from "@/lib/club-directory"
export const corkboardInput = z.object({ clubId: z.string().uuid(), saved: z.boolean() }).strict()
export type CorkboardItem = { club: DirectoryClub; savedAt: string }
