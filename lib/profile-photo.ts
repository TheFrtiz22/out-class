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

export type AccountIdentity = { email?: string | null; profile?: { firstName?: string | null; lastName?: string | null; headshotUrl?: string | null } | null }
export function accountInitials(user?: AccountIdentity | null) {
  const names = [user?.profile?.firstName?.trim(), user?.profile?.lastName?.trim()].filter((value): value is string => !!value)
  if (names.length) return names.map(name => Array.from(name)[0]).join("").toLocaleUpperCase()
  const local = user?.email?.split("@")[0] || ""
  const parts = local.split(/[._\s-]+/).filter(Boolean)
  return (parts.length > 1 ? parts.map(part => Array.from(part)[0]).slice(0, 2).join("") : Array.from(local).slice(0, 2).join("")).toLocaleUpperCase() || "OC"
}
