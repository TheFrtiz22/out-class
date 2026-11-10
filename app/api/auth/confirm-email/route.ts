import { sameOriginRequest } from "@/lib/request-origin";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { isUvaEmail } from "@/lib/auth";
import { authEmailError, confirmedEmailSession } from "@/lib/auth-email";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
import { DEMO_COOKIE } from "@/lib/demo/access";
import { registrationSchema } from "@/lib/onboarding-schemas";
import { confirmedByThisVerification, secureFirstConfirmation } from "@/lib/signup-password";
import { freshAuthClient } from "@/utils/admin-elevation";
import { createClient } from "@/utils/supabase/server";

// Every in-app email-code verification (signup wizard and code sign-in) comes here so the server, not the
// browser, finishes an account's first confirmation: it keeps only a password supplied with the code and
// signs out every other session before attaching the confirmed session to this browser.
const schema = z.object({
  email: z.string().trim().toLowerCase().email().refine(isUvaEmail),
  code: z.string().regex(/^\d{6}$/),
  password: z.string().max(128).optional(),
}).strict();

const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });

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
    const client = freshAuthClient();
    const startedAt = Date.now();
    const verified = await client.auth.verifyOtp({ email, token: code, type: "email" });
    if (verified.error) return reply({ error: authEmailError(verified.error, "verify") }, 400);
    if (!verified.data.session || !confirmedEmailSession({ session: verified.data.session, user: verified.data.user }, email)) {
      await client.auth.signOut({ scope: "local" }).catch(() => undefined);
      return reply({ error: "Unable to confirm your email. Please verify again." }, 400);
    }
    let firstConfirmation = false, passwordSaved = false;
    if (confirmedByThisVerification(verified.data.user, startedAt)) {
      firstConfirmation = true;
      const result = await secureFirstConfirmation(client, password);
      passwordSaved = result.passwordSaved;
      if (!result.secured) {
        console.warn("Email confirmed; first-confirmation password or session update incomplete");
        await client.auth.signOut({ scope: "local" }).catch(() => undefined);
        return reply({ error: "Email confirmed, but sign-in could not be completed. Reset your password to continue." }, 503);
      }
    }
    const normal = await createClient(jar);
    const attached = await normal.auth.setSession(verified.data.session);
    if (attached.error) return reply({ error: "Email confirmed. Sign in with an email code to continue." }, 400);
    return reply({ success: true, firstConfirmation, passwordSaved });
  } catch {
    return reply({ error: "Unable to verify this code. Check your connection and try again." }, 400);
  }
}
