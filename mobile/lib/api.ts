import { supabase } from "./supabase";

const base = (process.env.EXPO_PUBLIC_API_URL ?? "https://out-class.net").replace(/\/$/, "");
export const webUrl = (path: string) => `${base}${path.startsWith("/") ? path : `/${path}`}`;

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
    headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers, Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) await supabase.auth.signOut();
  if (!response.ok) throw new ApiError(response.status, body?.error ?? "Something went wrong. Please try again.");
  return body as T;
}

export const post = <T>(path: `/api/v1/${string}`, body: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(body) });

// Response shapes for the endpoints this build uses (see app/api/v1 on the web side).
export type Club = {
  id: string;
  name: string;
  logoText: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  color: string | null;
  category: string | null;
  pitch: string | null;
  tagline?: string | null;
  description?: string | null;
  acceptanceRate: number | null;
  applicationAvailable?: boolean;
  applicationDeadline?: string | null;
  rounds?: { id: string; name: string; order: number }[];
  requirements?: string[];
  testRequirement?: string;
  publicEvents?: { id: string; title: string; date: string; location: string }[];
};

export type Account = {
  id: string;
  email: string;
  profile: { firstName: string; lastName: string; gradYear: number; headshotUrl: string | null } | null;
  memberships: { id: string; role: string; club: { id: string; name: string; logoUrl: string | null; color: string | null } }[];
  applications: { id: string; status: string; submittedAt: string | null; club: { id: string; name: string } }[];
};

export type InboxItem = { id: string; type: string; title: string; body: string; href: string; read: boolean; createdAt: string; club: { id: string | null; name: string; color: string | null; logoUrl: string | null } | null };
export type Inbox = { items: InboxItem[]; unread: number; nextCursor: string | null };

export type TodoItem = { id: string; title: string; preview: string; club: string; clubId: string | null; urgent: boolean; dueAt: string | null; needsSubmission: boolean; href: string | null };

export type CalendarEvent = { id: string; title: string; club: string; clubId: string | null; type: string; date: string; startTime: string | null; endTime: string | null; allDay: boolean; location: string | null };

export type CampusEvent = {
  id: string; clubId: string; clubName: string; title: string; description: string | null; allDay: boolean;
  date: string; endDate: string | null; location: string | null; category: string | null;
  rsvpEnabled: boolean; capacity: number | null; rsvpDeadline: string | null; flyerUrl: string | null; rsvpCount: number;
};
export type Corkboard = { events: CampusEvent[]; total: number; hasMore: boolean; saved: string[]; going: string[] };
export type Following = { items: { club: Club; savedAt: string }[] };
