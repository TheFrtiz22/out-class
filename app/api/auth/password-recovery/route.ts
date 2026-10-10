import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isUvaEmail } from "@/lib/auth";
import {
  passwordReset,
  recoveryEmail,
  recoveryConfirmation,
} from "@/lib/password-recovery";
import { DEMO_COOKIE } from "@/lib/demo/access";
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as";

const reply = (body: object, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return reply({ error: "Request not allowed." }, 403);
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
            : "Use matching passwords of 8–128 characters and a valid reset link.",
      },
      400,
    );

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
  if (input.action === "request" && email.success) {
    try {
      const { error } = await client.auth.resetPasswordForEmail(email.data, {
        redirectTo: `${request.nextUrl.origin}/reset-password`,
      });
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
  try {
    const { data, error } = await client.auth.verifyOtp({
      token_hash: reset.data.tokenHash,
      type: "recovery",
    });
    if (
      error ||
      !data.session ||
      !data.user?.email ||
      !isUvaEmail(data.user.email)
    )
      return reply(
        {
          error:
            "This link is invalid, expired, or already used. Request a new reset link.",
          needsNewLink: true,
        },
        400,
      );
    const updated = await client.auth.updateUser({
      password: reset.data.password,
    });
    if (updated.error) {
      await client.auth.signOut({ scope: "local" });
      if (updated.error.code === "insufficient_aal")
        return reply(
          {
            error:
              "This account requires multi-factor authentication to change its password. Sign in with MFA, or contact OutClass support for account recovery.",
            needsNewLink: true,
          },
          400,
        );
      return reply(
        {
          error:
            "The password could not be changed. It must meet your account’s security requirements and differ from the current password. Request a new link to try again.",
          needsNewLink: true,
        },
        400,
      );
    }
    // A consumed email recovery token proves mailbox control even for legacy
    // accounts without a signup confirmation_sent_at. Bind server-only proof to
    // the exact provider identity and confirmation timestamp; email changes
    // invalidate the receipt. Never use an email/user ID supplied by the browser.
    const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (secret) {
      try {
        const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
        const current = await admin.auth.admin.getUserById(data.user.id);
        if (current.error || !current.data.user || current.data.user.id !== data.user.id ||
          current.data.user.email?.trim().toLowerCase() !== data.user.email.trim().toLowerCase() ||
          !current.data.user.email_confirmed_at ||
          current.data.user.email_confirmed_at !== data.user.email_confirmed_at) {
          throw new Error("Recovery identity changed.");
        }
        const identity = current.data.user;
        const recorded = await admin.auth.admin.updateUserById(identity.id, { app_metadata: {
          outclass_verified_email: { method: "password_recovery_v1", userId: identity.id,
            email: identity.email!.trim().toLowerCase(), emailConfirmedAt: identity.email_confirmed_at,
            verifiedAt: new Date().toISOString() },
        } });
        if (recorded.error) throw new Error("Recovery identity proof unavailable.");
      } catch {
        // The password already changed. Fail closed for invitation access while
        // preserving the existing recovery response and revocation behavior.
        console.warn("Password reset completed; university identity proof unavailable");
      }
    }
    // Revoke refresh sessions; existing access JWTs expire according to provider configuration.
    try {
      const signedOut = await client.auth.signOut({ scope: "global" });
      if (signedOut.error) throw signedOut.error;
    } catch {
      console.warn("Password reset completed; session revocation unavailable");
    }
    return reply({
      message:
        "Your password has been updated. Sign in with your new password.",
    });
  } catch {
    return reply(
      {
        error:
          "We couldn’t confirm the password change. Try signing in, or request a new reset link.",
        needsNewLink: true,
      },
      503,
    );
  }
}
