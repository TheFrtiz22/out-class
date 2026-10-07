import type { NextRequest } from "next/server";
/** Compare the browser Origin with the actual HTTP host, not Next's internal localhost URL.
 * Browsers cannot forge Host; forwarded-host headers never authorize a request. */
export function sameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") || request.nextUrl.host;
  try { return !!origin && origin === new URL(`${request.nextUrl.protocol}//${host}`).origin; }
  catch { return false; }
}
