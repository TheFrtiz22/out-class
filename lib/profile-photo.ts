import { storagePathSchema } from "@/lib/student-profile";
export type PhotoScope = { clubId: string; applicationId: string; roundId?: string; sessionId?: string; mode?: "evaluation" | "preview" | "crm" };
/** Stored references are paths. URLs are request-scoped authenticated endpoints. */
export function profilePhotoSource(value: string | null | undefined, scope?: PhotoScope): string | undefined {
  if (!value) return undefined;
  // Bundled fictional images remain available exclusively as presentation assets.
  if (value === "/images/landing/jordan-avery.jpg" || value === "/demo/sample-headshot.svg") return value;
  if (value.startsWith("/api/profile-photos?")) return value;
  if (!storagePathSchema.safeParse(value).success) return undefined;
  const params = new URLSearchParams({ path: value });
  if (scope) for (const [key, v] of Object.entries(scope)) if (v) params.set(key, v);
  return `/api/profile-photos?${params}`;
}
