import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  passwordReset,
  recoveryEmail,
  recoveryConfirmation,
} from "@/lib/password-recovery";
import { DEMO_COOKIE } from "@/lib/demo/access";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";
import { authTurnstile, captchaFailed, turnstileMessage, turnstileRemoteIp } from "@/lib/turnstile";
import { authRedirectOrigin } from "@/lib/site-origin";
import { RATE_LIMITS, limitRequest } from "@/lib/rate-limit";
import { passwordIssue } from "@/lib/password-policy";
import { completePasswordReset } from "@/lib/password-reset-complete";

const reply = (body: object, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return reply({ error: "Request not allowed." }, 403);
  const limited = limitRequest(request, RATE_LIMITS.passwordRecovery);
  if (limited) return limited;
  if (
    request.cookies.get(DEMO_COOKIE)?.value === "1" ||
    request.cookies.has(PLATFORM_VIEW_COOKIE)
  )
    return reply(
      {
        error:
          "Exit demo or administrator view before recovering your password.",
      },
      403,
    );
  let input;
  try {
    input = await request.json();
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }
  if (!input || !["request", "reset"].includes(input.action))
    return reply({ error: "Invalid request." }, 400);
  const email = recoveryEmail.safeParse(input.email);
  const reset = passwordReset.safeParse(input);
  if (input.action === "request" ? !email.success : !reset.success)
    return reply(
      {
        error:
          input.action === "request"
            ? "Enter a valid UVA email address."
            : (passwordIssue(input.password) ?? "Use matching passwords and a valid reset link."),
      },
      400,
    );

  // Same responses for every address: the reset-link origin and the bot check
  // both run before any account or provider lookup. The origin is checked first
  // so a guaranteed 503 never spends the visitor's single-use Turnstile token.
  // Reset links always point at the configured site URL, never the request's Host.
  const siteOrigin = input.action === "request" ? authRedirectOrigin(request.nextUrl.origin) : null;
  if (input.action === "request" && !siteOrigin)
    return reply(
      {
        error:
          "Password recovery is temporarily unavailable. Please try again later.",
      },
      503,
    );
  let captcha: { captchaToken?: string } = {};
  if (input.action === "request") {
    const check = await authTurnstile(input.turnstileToken, {
      action: "password-recovery",
      remoteIp: turnstileRemoteIp(request.headers.get("x-forwarded-for")),
    });
    if (!check.ok)
      return reply({ error: turnstileMessage(check.reason) }, check.reason === "unavailable" ? 503 : 400);
    captcha = check.captcha;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    return reply(
      {
        error:
          "Password recovery is temporarily unavailable. Please try again later.",
      },
      503,
    );
  // Isolated provider client: never exchange or overwrite the visitor's existing account cookies.
  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  if (input.action === "request" && email.success && siteOrigin) {
    try {
      // Only requests send email. The token is forwarded only when Supabase verifies it.
      const { error } = await client.auth.resetPasswordForEmail(email.data, {
        redirectTo: `${siteOrigin}/reset-password`,
        ...captcha,
      });
      // A failed security check says nothing about whether the account exists.
      if (captchaFailed(error))
        return reply({ error: turnstileMessage("rejected") }, 400);
      if (error)
        console.warn("Password recovery delivery unavailable", {
          code: error.code,
          status: error.status,
        });
    } catch {
      console.warn("Password recovery provider unavailable");
    }
    // Account absence, throttling, and delivery failures have the same public response.
    return reply({ message: recoveryConfirmation });
  }
  if (!reset.success) return reply({ error: "Invalid request." }, 400);
  const completed = await completePasswordReset(client, reset.data, url);
  return reply(completed.body, completed.status);}
