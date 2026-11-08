import { NextResponse } from "next/server";
import { BearerAuthError } from "@/utils/bearer-auth";

/**
 * Shared response conventions for the native-client API under /api/v1.
 * Responses are never cached by intermediaries, and unexpected failures never
 * echo internal error text to the client.
 */
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };

export function v1Json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers });
}

export function v1Error(error: unknown, label: string) {
  if (error instanceof BearerAuthError) return v1Json({ error: error.message }, error.status);
  console.error(`${label} unavailable`);
  return v1Json({ error: "Something went wrong. Please try again." }, 500);
}
