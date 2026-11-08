import { supabase } from "./supabase";

const base = (process.env.EXPO_PUBLIC_API_URL ?? "https://out-class.net").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Calls an OutClass /api/v1 endpoint with the signed-in user's access token. */
export async function api<T>(path: `/api/v1/${string}`, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, "Sign-in required.");
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init.headers, Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) await supabase.auth.signOut();
  if (!response.ok) throw new ApiError(response.status, body?.error ?? "Something went wrong. Please try again.");
  return body as T;
}

// Response shapes for the endpoints this build uses. Kept small on purpose;
// a shared types package can replace these once more endpoints exist.
export type Club = {
  id: string;
  name: string;
  logoText: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  color: string | null;
  category: string | null;
  pitch: string | null;
  acceptanceRate: number | null;
  applicationAvailable?: boolean;
  applicationDeadline?: string | null;
  rounds?: { id: string; name: string; order: number }[];
};

export type Account = {
  id: string;
  email: string;
  profile: { firstName: string; lastName: string; gradYear: number; headshotUrl: string | null } | null;
  memberships: { id: string; role: string; club: { id: string; name: string; logoUrl: string | null; color: string | null } }[];
  applications: { id: string; status: string; submittedAt: string | null; club: { id: string; name: string } }[];
};
