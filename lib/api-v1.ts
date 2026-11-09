import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BearerAuthError } from "@/utils/bearer-auth";
import { withBearerIdentity } from "@/utils/bearer-context";

/**
 * Shared conventions for the native-client API under /api/v1.
 * Responses are never cached by intermediaries, and unexpected failures never
 * echo internal error text to the client.
 */
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };

export function v1Json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers });
}

export function v1Error(error: unknown, label: string) {
  if (error instanceof BearerAuthError) return v1Json({ error: error.message }, error.status);
  if (error instanceof ZodError) return v1Json({ error: "That request isn’t valid." }, 400);
  console.error(`${label} unavailable`);
  return v1Json({ error: "Something went wrong. Please try again." }, 500);
}

/**
 * Runs an existing server action for the bearer token's account. The token is
 * verified first; inside `run`, `requireAuth()` and `requireClubPermission()`
 * resolve that account, so the action's own authorization applies unchanged.
 */
export async function v1Route(request: Request, label: string, run: () => Promise<unknown>) {
  try {
    return v1Json(await withBearerIdentity(request, run));
  } catch (error) {
    return v1Error(error, label);
  }
}

/** Parses a JSON body; anything that isn't a JSON object becomes a 400. */
export async function v1Body(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ZodError([]);
  return body as Record<string, unknown>;
}
