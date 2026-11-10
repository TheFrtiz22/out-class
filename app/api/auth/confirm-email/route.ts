import { sameOriginRequest } from "@/lib/request-origin";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient as providerClient } from "@supabase/supabase-js";
import { isUvaEmail } from "@/lib/auth";
import { confirmedEmailSession } from "@/lib/auth-email";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
import { DEMO_COOKIE } from "@/lib/demo/access";
import { registrationSchema } from "@/lib/onboarding-schemas";
import { turnstileRemoteIp } from "@/lib/turnstile";
import { EMAIL_CODE_REJECTED, passwordAlreadySecured, recordEmailCodeAttempt, secureVerifiedAccount } from "@/lib/email-confirmation";
import { freshAuthClient } from "@/utils/admin-elevation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prisma";

// Every in-app email-code verification (signup wizard and code sign-in) comes here. Until an account's
// password has been recorded as set by a verified session, a verified code keeps only the password sent
// with it and signs out every other session; then the confirmed session is attached to this browser.
const schema = z.object({
  email: z.string().trim().toLowerCase().email().refine(isUvaEmail),
  code: z.string().regex(/^\d{6}$/),
  password: z.string().max(128).optional(),
}).strict();

const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });

function adminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  return providerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: NextRequest) {
  if (!sameOriginRequest(request)) return reply({ error: "Request not allowed." }, 403);
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
    if (!(await recordEmailCodeAttempt(prisma, email, turnstileRemoteIp(request.headers.get("x-forwarded-for")))))
      return reply({ error: EMAIL_CODE_REJECTED }, 400);
    const client = freshAuthClient();
    const verified = await client.auth.verifyOtp({ email, token: code, type: "email" });
    if (verified.error) return reply({ error: EMAIL_CODE_REJECTED }, 400);
    const user = verified.data.user;
    if (!verified.data.session || !user || !confirmedEmailSession({ session: verified.data.session, user }, email)) {
      await client.auth.signOut({ scope: "local" }).catch(() => undefined);
      return reply({ error: "Unable to confirm your email. Please verify again." }, 400);
    }
    let passwordUpdated = false, passwordSaved = false;
    if (!passwordAlreadySecured(user)) {
      passwordUpdated = true;
      const result = await secureVerifiedAccount(client, adminClient(), user, password);
      passwordSaved = result.passwordSaved;
      if (!result.secured) {
        console.warn("Email code verified; password or session update incomplete");
        await client.auth.signOut({ scope: "local" }).catch(() => undefined);
        return reply({ error: "Email confirmed, but sign-in could not be completed. Request a new code and try again." }, 503);
      }
      if (!result.recorded) console.warn("Email code verified; password state not recorded");
    }
    const attached = await normal.auth.setSession(verified.data.session);
    if (attached.error) return reply({ error: "Email confirmed. Sign in with an email code to continue." }, 400);
    return reply({ success: true, passwordUpdated, passwordSaved });
  } catch {
    return reply({ error: "Unable to verify this code. Check your connection and try again." }, 400);
  }
}
