import { config } from "~/lib/config";
import { supabase } from "~/lib/supabase";

/** A refusal or failure from the mobile API. `message` is the server's own wording, written for people. */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
  get offline() { return this.code === "OFFLINE"; }
  get signedOut() { return this.status === 401; }
}

export const OFFLINE_MESSAGE = "You're offline. Check your connection and try again.";
const GENERIC_MESSAGE = "Something went wrong. Try again in a moment.";

async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

type CallOptions = { signal?: AbortSignal; anonymous?: boolean };

async function request<T>(method: "GET" | "POST", operation: string, input: unknown, options: CallOptions): Promise<T> {
  const url = new URL(`/api/mobile/v1/${operation}`, config.apiUrl);
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = options.anonymous ? null : await accessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (method === "GET") {
    if (input !== undefined) url.searchParams.set("input", JSON.stringify(input));
  } else if (input instanceof FormData) {
    body = input;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(input ?? null);
  }
  let response: Response;
  try {
    response = await fetch(url.toString(), { method, headers, body, signal: options.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(0, "OFFLINE", OFFLINE_MESSAGE);
  }
  let payload: { data?: T; error?: { code?: string; message?: string } } | null = null;
  try { payload = await response.json(); } catch { /* handled below */ }
  if (response.ok && payload && "data" in payload) return payload.data as T;
  const refusal = payload?.error;
  if (response.status === 401 && token) {
    // The server no longer accepts this session (signed out elsewhere, expired, disabled).
    // Only Auth saying the session is gone signs the person out. A refresh that could not reach Auth
    // (a bad connection) leaves them signed in to try again.
    const refreshed = await supabase.auth.refreshSession();
    const status = (refreshed.error as { status?: number } | null)?.status;
    if (refreshed.error && typeof status === "number" && status >= 400 && status < 500) await supabase.auth.signOut({ scope: "local" });
  }
  throw new ApiError(response.status, refusal?.code ?? "UNAVAILABLE", refusal?.message ?? GENERIC_MESSAGE);
}

export const api = {
  get: <T>(operation: string, input?: unknown, options: CallOptions = {}) => request<T>("GET", operation, input, options),
  post: <T>(operation: string, input?: unknown, options: CallOptions = {}) => request<T>("POST", operation, input, options),
};

/** The message to show for any thrown value: the server's wording for refusals, a calm fallback otherwise. */
export function errorMessage(error: unknown, fallback = GENERIC_MESSAGE): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** An authenticated URL for private media the web serves through its own routes (photos, resumes). */
export async function authorizedSource(path: string): Promise<{ uri: string; headers?: Record<string, string> }> {
  const token = await accessToken();
  return { uri: new URL(path, config.apiUrl).toString(), headers: token ? { Authorization: `Bearer ${token}` } : undefined };
}

export type MediaKind = "profile-photos" | "resumes" | "application-attachments" | "club-assets" | "decision-letter-assets" | "interview-resumes" | "recruiting-resumes";

/**
 * Private media through the mobile API: the web's own media handlers, reached with this session
 * (app/api/mobile/v1/media). `params` are the same query parameters the web route takes, e.g.
 * `mediaSource("profile-photos", { path })` for the signed-in person's own photo. Use the result
 * as an expo-image `source`, or fetch it; the server decides whether this account may see it.
 */
export async function mediaSource(kind: MediaKind, params: Record<string, string | undefined>): Promise<{ uri: string; headers?: Record<string, string> }> {
  const url = new URL(`/api/mobile/v1/media/${kind}`, config.apiUrl);
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
  const token = await accessToken();
  return { uri: url.toString(), headers: token ? { Authorization: `Bearer ${token}` } : undefined };
}
