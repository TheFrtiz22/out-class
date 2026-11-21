import { sameOriginRequest } from "@/lib/request-origin";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isUvaEmail } from "@/lib/auth";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
import { DEMO_COOKIE } from "@/lib/demo/access";
import { registrationSchema } from "@/lib/onboarding-schemas";
import { RATE_LIMITS, clientIp, limitRequest, nodeIsIp } from "@/lib/rate-limit";
import { verifyEmailCode } from "@/lib/email-code-session";
import { createClient } from "@/utils/supabase/server";

// Every in-app email-code verification (signup wizard and code sign-in) comes here. The code is verified
// by lib/email-code-session.ts (shared with the native app); the confirmed session is attached to this browser.
const schema = z.object({
  email: z.string().trim().toLowerCase().email().refine(isUvaEmail),
  code: z.string().regex(/^\d{6}$/),
  password: z.string().max(128).optional(),
}).strict();

const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });

function clientAddress(request: NextRequest) {
  return clientIp(request.headers.get("x-forwarded-for"), nodeIsIp) ?? undefined;
}

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return reply({ error: "Request not allowed." }, 403);
  // Per-instance burst limit before any database or Auth work; the durable limits are below.
  const limited = limitRequest(request, RATE_LIMITS.emailCode);
  if (limited) return limited;
  const jar = await cookies();
  if (jar.has(PLATFORM_VIEW_COOKIE) || jar.get(DEMO_COOKIE)?.value === "1")
    return reply({ error: "Exit demo or administrator view before changing authentication." }, 403);
  let input;
  try { input = schema.safeParse(await request.json()); } catch { return reply({ error: "Invalid request." }, 400); }
  if (!input.success) return reply({ error: "Enter the 6-digit code sent to your UVA email." }, 400);
  const { email, code } = input.data;
  // A password that does not meet the signup rules is treated as not supplied.
  const password = registrationSchema.shape.password.safeParse(input.data.password).success ? input.data.password : undefined;
  try {
    const normal = await createClient(jar);
    const current = await normal.auth.getUser();
    if (current.data.user && current.data.user.email?.toLowerCase() !== email)
      return reply({ error: "Sign out of the other account before using this code." }, 409);
    const verified = await verifyEmailCode({ email, code, password, clientIp: clientAddress(request) });
    if (!verified.ok) return reply({ error: verified.error }, verified.status);
    const { session, passwordUpdated, passwordSaved } = verified;
    const attached = await normal.auth.setSession(session);
    if (attached.error) return reply({ error: "Email confirmed. Sign in with an email code to continue." }, 400);
    return reply({ success: true, passwordUpdated, passwordSaved });
  } catch {
    return reply({ error: "Unable to verify this code. Check your connection and try again." }, 400);
  }
}
