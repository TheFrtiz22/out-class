import { z } from "zod";
import { clubProfileSchema } from "@/lib/club-marketing";
export const adminClubInput = z.object({
  id: z.string().uuid().optional(), version: z.string().max(64).optional(),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  schoolId: z.string().min(1).max(100), isDiscoverable: z.boolean(),
  applicationOpen: z.boolean(), applicationDeadline: z.string().datetime().nullable(),
  profile: clubProfileSchema, reason: z.string().trim().min(10).max(1000),
}).strict();
export const adminClubFilters = z.object({ query: z.string().trim().max(200).default(''), status: z.enum(['ALL','ACTIVE','SUSPENDED','DISCOVERABLE','HIDDEN','RECRUITING']).default('ALL'), page: z.number().int().min(0).max(10000).default(0) }).strict();
