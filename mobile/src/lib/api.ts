import { config } from "~/lib/config";
import { supabase } from "~/lib/supabase";

/** A refusal or failure from the mobile API. `message` is the server's own wording, written for people. */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
  get offline() { return this.code === "OFFLINE"; }
  /** The request never got an answer from OutClass: no connection, or no reply in time. */
  get unreachable() { return this.code === "OFFLINE" || this.code === "TIMEOUT"; }
  get signedOut() { return this.status === 401; }
}

export const OFFLINE_MESSAGE = "You're offline. Check your connection and try again.";
export const TIMEOUT_MESSAGE = "OutClass is taking too long to answer. Check your connection and try again.";
const GENERIC_MESSAGE = "Something went wrong. Try again in a moment.";
const RATE_LIMIT_MESSAGE = "Too many requests. Wait a moment and try again.";

/** How long a request may wait for an answer before it is given up (uploads get longer). */
const TIMEOUT_MS = { GET: 20_000, POST: 30_000, upload: 120_000 } as const;

const timeoutError = () => new ApiError(0, "TIMEOUT", TIMEOUT_MESSAGE);

/** Rejects with a timeout when `promise` has not settled in `ms` (a hung Keychain or Auth call never spins forever). */
function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(timeoutError()), ms); })]).finally(() => clearTimeout(timer));
}

async function accessToken(): Promise<string | null> {
  const { data } = await within(supabase.auth.getSession(), TIMEOUT_MS.GET);
  return data.session?.access_token ?? null;
}

// One refresh at a time: every request that meets a 401 together waits on the same one.
let refreshing: Promise<boolean> | null = null;
/** True when Auth issued a new session. Only Auth saying the session is gone signs the person out;
 * a refresh that could not reach Auth (a bad connection) leaves them signed in to try again. */
function refreshAfterUnauthorized(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const refreshed = await within(supabase.auth.refreshSession(), TIMEOUT_MS.GET);
      const status = (refreshed.error as { status?: number } | null)?.status;
      if (refreshed.error && typeof status === "number" && status >= 400 && status < 500) await supabase.auth.signOut({ scope: "local" });
      return !refreshed.error && !!refreshed.data.session;
    } catch { return false; } finally { refreshing = null; }
  })();
  return refreshing;
}

type CallOptions = { signal?: AbortSignal; anonymous?: boolean };

/**
 * A multipart upload. Picked files are `{ uri, name, type }` parts, which the runtime's `fetch`
 * refuses (expo/src/winter/fetch/convertFormData.ts: "`uri` is not supported"); React Native's
 * XMLHttpRequest reads the file from its address and streams it.
 */
function sendForm(url: string, headers: Record<string, string>, form: FormData, signal?: AbortSignal): Promise<Pick<Response, "ok" | "status" | "json">> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    xhr.open("POST", url);
    xhr.timeout = TIMEOUT_MS.upload;
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.onload = () => { signal?.removeEventListener("abort", abort); resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, json: async () => JSON.parse(xhr.responseText) }); };
    xhr.ontimeout = () => { signal?.removeEventListener("abort", abort); reject(timeoutError()); };
    const aborted = () => Object.assign(new Error("Aborted"), { name: "AbortError" });
    xhr.onerror = xhr.onabort = () => { signal?.removeEventListener("abort", abort); reject(signal?.aborted ? aborted() : new TypeError("Network request failed")); };
    if (signal?.aborted) { reject(aborted()); return; }
    signal?.addEventListener("abort", abort);
    xhr.send(form);
  });
}

/** `fetch` with a deadline. The caller's own abort still surfaces as an AbortError; the deadline as a TIMEOUT refusal. */
async function fetchWithin(url: string, init: RequestInit & { signal?: AbortSignal }, ms: number): Promise<Response> {
  const controller = new AbortController();
  const outer = init.signal;
  let timedOut = false;
  const forward = () => controller.abort();
  if (outer?.aborted) controller.abort(); else outer?.addEventListener("abort", forward);
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut && !outer?.aborted) throw timeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", forward);
  }
}

async function request<T>(method: "GET" | "POST", operation: string, input: unknown, options: CallOptions, retried = false): Promise<T> {
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
  let response: Pick<Response, "ok" | "status" | "json">;
  try {
    response = input instanceof FormData && method === "POST" ? await sendForm(url.toString(), headers, input, options.signal) : await fetchWithin(url.toString(), { method, headers, body, signal: options.signal }, TIMEOUT_MS[method]);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(0, "OFFLINE", OFFLINE_MESSAGE);
  }
  let payload: unknown = null;
  try { payload = await within(response.json(), TIMEOUT_MS[method]); } catch { /* handled below */ }
  const answer = payload && typeof payload === "object" ? payload as { data?: T; error?: unknown } : null;
  if (response.ok && answer && "data" in answer) return answer.data as T;
  // The address-level rate limit answers with the message alone (lib/rate-limit-core.ts).
  const refusal = typeof answer?.error === "string" ? { code: response.status === 429 ? "RATE_LIMITED" : undefined, message: answer.error }
    : answer?.error && typeof answer.error === "object" ? answer.error as { code?: unknown; message?: unknown } : null;
  const code = typeof refusal?.code === "string" ? refusal.code : response.status === 429 ? "RATE_LIMITED" : "UNAVAILABLE";
  const message = typeof refusal?.message === "string" && refusal.message ? refusal.message : response.status === 429 ? RATE_LIMIT_MESSAGE : GENERIC_MESSAGE;
  // The server no longer accepts this session (expired, signed out elsewhere, disabled). A refused
  // request did nothing, so after a successful refresh it is sent once more with the new session.
  // A pending second step is not a stale session; refreshing would not change the answer.
  if (response.status === 401 && token && code !== "TWO_STEP_REQUIRED" && !retried && !options.signal?.aborted) {
    if (await refreshAfterUnauthorized()) return request<T>(method, operation, input, options, true);
  }
  throw new ApiError(response.status, code, message);
}

export const api = {
  get: <T>(operation: string, input?: unknown, options: CallOptions = {}) => request<T>("GET", operation, input, options),
  post: <T>(operation: string, input?: unknown, options: CallOptions = {}) => request<T>("POST", operation, input, options),
};

/** The message to show for any thrown value: the server's wording for refusals, a calm fallback otherwise. */
export function errorMessage(error: unknown, fallback = GENERIC_MESSAGE): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** A session token for a media request; a hung or failed Keychain read sends the request without one. */
const mediaToken = () => accessToken().catch(() => null);

/** An authenticated URL for private media the web serves through its own routes (photos, resumes). */
export async function authorizedSource(path: string): Promise<{ uri: string; headers?: Record<string, string> }> {
  const token = await mediaToken();
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
  const token = await mediaToken();
  return { uri: url.toString(), headers: token ? { Authorization: `Bearer ${token}` } : undefined };
}
