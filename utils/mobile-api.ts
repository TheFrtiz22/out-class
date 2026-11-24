import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { z } from "zod";
import { ActionError, isActionError, isActionResult } from "@/lib/action-result";
import { assertBoundedInput } from "@/lib/bounded-input";
import { DEMO_COOKIE } from "@/lib/demo/access";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
import { RATE_LIMITS, RATE_LIMIT_MESSAGE, rateLimiter, rateLimitHeaders } from "@/lib/rate-limit-core";
import { TWO_STEP_REQUIRED_MESSAGE } from "@/lib/user-mfa";
import { providerAuthFailure } from "@/lib/admin-failure";
import { AUTH_UNAVAILABLE, AUTH_UNAVAILABLE_MESSAGE, getSessionState } from "@/utils/auth";
import { runMobileRequest } from "@/utils/mobile-request";
import { UniversityVerificationError } from "@/utils/verified-email-policy";

/**
 * The native app's HTTP boundary (docs/mobile/architecture.md).
 *
 * An operation is a named, allowlisted call into an existing Server Action or loader. This file
 * authenticates the bearer token, validates and bounds the input, and maps refusals to HTTP.
 * It holds no permission logic: identity, capability, ownership, revision and audit checks stay in
 * the action each operation calls, exactly as the web runs them.
 */
export type MobileOperation<Input = unknown, Output = unknown> = {
  /** GET operations read; POST operations change state and get the maintenance-mode refusal. */
  method: "GET" | "POST";
  input: z.ZodType<Input, z.ZodTypeDef, unknown>;
  run: (input: Input, request: Request) => Promise<Output>;
  /** Public operations (the club directory) run without a bearer token, as they do on the web. */
  public?: boolean;
  /** A larger JSON body than the default 512,000 characters (a long application draft). */
  maxBytes?: number;
};

/** Any registered operation, whatever its input and output types. */
export type AnyMobileOperation = { method: "GET" | "POST"; input: z.ZodTypeAny; run: (input: never, request: Request) => Promise<unknown>; public?: boolean; maxBytes?: number };

export function operation<Schema extends z.ZodTypeAny, Output>(method: "GET" | "POST", input: Schema, run: (input: z.output<Schema>, request: Request) => Promise<Output>, options: { public?: boolean; maxBytes?: number } = {}): MobileOperation<z.output<Schema>, Output> {
  return { method, input, run, ...options };
}

const baseHeaders = { "Cache-Control": "private, no-store", "Content-Type": "application/json; charset=utf-8", Vary: "Authorization" };

export type MobileErrorBody = { error: { code: string; message: string } };
function refusal(status: number, code: string, message: string, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify({ error: { code, message } } satisfies MobileErrorBody), { status, headers: { ...baseHeaders, ...extra } });
}

/** ActionError codes that have a precise HTTP meaning; every other refusal is 422 with its own code. */
const statusByCode: Record<string, number> = {
  FORBIDDEN: 403, ACCESS_REVOKED: 403, ALUMNI_ACCOUNT: 403, ADMIN_ACCESS_DENIED: 403,
  NOT_FOUND: 404, CONFLICT: 409, STALE: 409, REVISION_CONFLICT: 409,
  RATE_LIMITED: 429, [AUTH_UNAVAILABLE]: 503,
};
const refusalStatus = (code: string) => statusByCode[code] ?? 422;

/** The native app never sends cookies. A request that carries a browser session (a Supabase auth cookie,
 * Demo Mode or a support session) is a browser, and mixing its cookies with a bearer token could let one
 * identity stand in for the other in code that reads cookies directly. Such requests are refused outright. */
function carriesBrowserSession(cookieStore: Awaited<ReturnType<typeof cookies>>): boolean {
  return cookieStore.get(DEMO_COOKIE)?.value === "1" || cookieStore.has(PLATFORM_VIEW_COOKIE)
    || cookieStore.getAll().some(cookie => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name));
}

function bearerToken(request: Request): string | null {
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(request.headers.get("authorization") ?? "");
  return match ? match[1] : null;
}

const digest = (error: unknown) => error && typeof error === "object" && "digest" in error ? String((error as { digest: unknown }).digest) : "";

const DEFAULT_MAX_BODY = 512_000;

async function readInput(request: Request, method: "GET" | "POST", maxBytes = DEFAULT_MAX_BODY): Promise<unknown> {
  if (method === "GET") {
    const raw = new URL(request.url).searchParams.get("input");
    return raw === null ? undefined : JSON.parse(raw);
  }
  const type = request.headers.get("content-type") ?? "";
  if (type.startsWith("multipart/form-data")) return await request.formData();
  const text = await request.text();
  if (text.length > maxBytes) throw new z.ZodError([{ code: "custom", path: [], message: "Request is too large." }]);
  return text ? JSON.parse(text) : undefined;
}

export async function handleMobileRequest(request: Request, name: string, operations: Record<string, MobileOperation>): Promise<Response> {
  const found = Object.hasOwn(operations, name) ? operations[name] : undefined;
  if (!found) return refusal(404, "UNKNOWN_OPERATION", "This app version asked for something the server does not offer.");
  if (request.method !== found.method) return refusal(405, "METHOD_NOT_ALLOWED", "Method not allowed.", { Allow: found.method });
  if (carriesBrowserSession(await cookies())) return refusal(403, "UNSUPPORTED_SESSION", "The mobile API is for the OutClass app. Use the website in a browser.");
  const token = bearerToken(request);
  if (!token && !found.public) return refusal(401, "UNAUTHENTICATED", "Sign in to continue.");

  const run = async (): Promise<Response> => {
    try {
      if (token) {
        const state = await getSessionState();
        if (state.secondFactorPending) return refusal(401, "TWO_STEP_REQUIRED", TWO_STEP_REQUIRED_MESSAGE);
        const { data: { user }, error } = state.identity;
        if (error && !providerAuthFailure(error)) {
          // An Auth outage, not a sign-out. Name and status only, so a recurring cause can be traced.
          console.warn(JSON.stringify({ event: "mobile.auth.unavailable", operation: name, error: error.name, status: (error as { status?: unknown }).status ?? null }));
          return refusal(503, AUTH_UNAVAILABLE, AUTH_UNAVAILABLE_MESSAGE);
        }
        if (!user) return found.public ? await execute() : refusal(401, "UNAUTHENTICATED", "Sign in to continue.");
        const limit = rateLimiter.check(RATE_LIMITS.mobileApi, `user:${user.id}`);
        if (!limit.ok) return refusal(429, "RATE_LIMITED", RATE_LIMIT_MESSAGE, rateLimitHeaders(limit.retryAfterSeconds));
        // Maintenance mode: every write is refused for non-admins, as for Server Actions (requireAuth also
        // checks; this covers an operation whose action authenticates another way).
        if (found.method === "POST") await (await import("@/utils/site-settings")).assertSiteWritable(user.id);
      }
      return await execute();
    } catch (error) {
      return failure(error, name);
    }
  };
  const execute = async (): Promise<Response> => {
    const maxBytes = found.maxBytes ?? DEFAULT_MAX_BODY;
    const raw = await readInput(request, found.method, maxBytes);
    if (!(raw instanceof FormData)) assertBoundedInput(raw, { maxArrayLength: 500, maxTotalElements: 2_000, maxBytes });
    const result = await found.run(found.input.parse(raw), request);
    if (isActionResult(result)) {
      return result.ok ? success(result.data) : refusal(refusalStatus(result.code), result.code, result.error);
    }
    return success(result);
  };
  // Always inside the mobile context: without a token the request is signed out (public operations only).
  return runMobileRequest({ token: token ?? "", write: found.method === "POST" }, run);
}

function success(data: unknown) {
  return new Response(JSON.stringify({ data: data === undefined ? null : data }), { status: 200, headers: baseHeaders });
}

function failure(error: unknown, name: string): Response {
  if (isActionError(error)) return refusal(refusalStatus(error.code), error.code, error.message);
  if (error instanceof z.ZodError || error instanceof SyntaxError) return refusal(400, "INVALID_REQUEST", "That request was not understood.");
  if (error instanceof UniversityVerificationError) return refusal(error.code === "UNIVERSITY_VERIFICATION_REQUIRED" ? 403 : 503, error.code, "University email verification is required.");
  if (error instanceof Error && error.name === "MaintenanceModeError") return refusal(503, "MAINTENANCE", error.message);
  const mark = digest(error);
  // requireAuth redirects a signed-out or unconfirmed caller; a loader's notFound() is a 404.
  if (mark.startsWith("NEXT_REDIRECT")) return refusal(401, "UNAUTHENTICATED", "Sign in to continue.");
  if (mark.startsWith("NEXT_HTTP_ERROR_FALLBACK;404") || mark === "NEXT_NOT_FOUND") return refusal(404, "NOT_FOUND", "Not found.");
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string" && error.code in statusByCode)
    return refusal(statusByCode[error.code], error.code, error.code === "RATE_LIMITED" ? RATE_LIMIT_MESSAGE : "This is not available.");
  // A database or runtime fault is an outage, not a refusal.
  const kind = error instanceof Error ? error.name : "";
  if (!(error instanceof Error) || /^Prisma|^TypeError$|^RangeError$|^ReferenceError$/.test(kind)) {
    console.error(JSON.stringify({ event: "mobile.operation.error", operation: name, error: kind || typeof error }));
    return refusal(500, "UNAVAILABLE", "Something went wrong. Try again in a moment.");
  }
  // Legacy loaders throw plain Errors for refusals ("Forbidden", "Not found"). Their messages are
  // not written for people and may name internals, so only the operation and error class are logged.
  // The web's read route answers the same way (403, generic text).
  console.warn(JSON.stringify({ event: "mobile.operation.refused", operation: name, error: kind }));
  return refusal(403, "REFUSED", "This is not available.");
}

export { ActionError };

/**
 * Private media for the native app (photos, resumes, attachments, letter and club images).
 * The web serves these through its own route handlers, each with its own authorization
 * (owner-only resumes, context-scoped applicant photos, and so on). The app calls the SAME
 * handler: this only verifies the bearer session and opens the mobile request context, so the
 * handler's `requireAuth` sees the app's user. No authorization is restated here.
 */
export async function handleMobileMedia(request: Request, handler: ((request: NextRequest) => Promise<Response>) | undefined): Promise<Response> {
  if (!handler) return refusal(404, "UNKNOWN_OPERATION", "This app version asked for something the server does not offer.");
  if (carriesBrowserSession(await cookies())) return refusal(403, "UNSUPPORTED_SESSION", "The mobile API is for the OutClass app. Use the website in a browser.");
  const token = bearerToken(request);
  if (!token) return refusal(401, "UNAUTHENTICATED", "Sign in to continue.");
  return runMobileRequest({ token, write: false }, async () => {
    try {
      const state = await getSessionState();
      if (state.secondFactorPending) return refusal(401, "TWO_STEP_REQUIRED", TWO_STEP_REQUIRED_MESSAGE);
      const { data: { user }, error } = state.identity;
      if (error && !providerAuthFailure(error)) return refusal(503, AUTH_UNAVAILABLE, AUTH_UNAVAILABLE_MESSAGE);
      if (!user) return refusal(401, "UNAUTHENTICATED", "Sign in to continue.");
      const limit = rateLimiter.check(RATE_LIMITS.mobileApi, `user:${user.id}`);
      if (!limit.ok) return refusal(429, "RATE_LIMITED", RATE_LIMIT_MESSAGE, rateLimitHeaders(limit.retryAfterSeconds));
      // The handler reads only the query string; the bearer token is not passed on.
      const url = new URL(request.url);
      // The address keeps the handlers' own per-address limits per phone, and Range keeps resume paging working.
      const forwarded: Record<string, string> = { accept: request.headers.get("accept") ?? "*/*" };
      for (const name of ["x-forwarded-for", "range"]) { const value = request.headers.get(name); if (value) forwarded[name] = value; }
      return await handler(new NextRequest(url, { method: "GET", headers: forwarded }));
    } catch (error) {
      return failure(error, "media");
    }
  });
}
