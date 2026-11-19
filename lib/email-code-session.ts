import { confirmedEmailSession } from "@/lib/auth-email";
import { EMAIL_CODE_FACTOR_BLOCKED, EMAIL_CODE_LIMITED, EMAIL_CODE_REJECTED, passwordAlreadySecured, recordEmailCodeAttempt, recordEmailCodeSuccess, secureVerifiedAccount } from "@/lib/email-confirmation";
import { forwardedAuthClient, serviceAuthClient } from "@/utils/admin-elevation";
import { prisma } from "@/utils/prisma";

export type EmailCodeSession =
  | { ok: true; session: { access_token: string; refresh_token: string }; passwordUpdated: boolean; passwordSaved: boolean }
  | { ok: false; status: number; error: string };

/**
 * Verifies an email code and returns the confirmed session, for the web route (which attaches it to
 * the browser's cookies) and the native app (which stores it on the device). Until an account's
 * password has been recorded as set by a verified session, a verified code keeps only the password
 * sent with it and signs out every other session. The caller has already applied its burst limit.
 */
export async function verifyEmailCode(input: { email: string; code: string; password?: string; clientIp?: string }): Promise<EmailCodeSession> {
  const { email, code, password, clientIp } = input;
  const admin = serviceAuthClient();
  if (!admin) {
    console.error("Email code verification needs the Supabase secret key");
    return { ok: false, status: 503, error: "Email sign-in is temporarily unavailable. Please try again later." };
  }
  if (!(await recordEmailCodeAttempt(prisma, email, clientIp)))
    return { ok: false, status: 429, error: EMAIL_CODE_LIMITED };
  const client = forwardedAuthClient(clientIp);
  const verified = await client.auth.verifyOtp({ email, token: code, type: "email" });
  if (verified.error) return { ok: false, status: 400, error: EMAIL_CODE_REJECTED };
  await recordEmailCodeSuccess(prisma, email, clientIp).catch(() => undefined);
  const user = verified.data.user;
  if (!verified.data.session || !user || !confirmedEmailSession({ session: verified.data.session, user }, email)) {
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
    return { ok: false, status: 400, error: "Unable to confirm your email. Please verify again." };
  }
  let passwordUpdated = false, passwordSaved = false;
  let session: { access_token: string; refresh_token: string } = verified.data.session;
  if (!passwordAlreadySecured(user)) {
    passwordUpdated = true;
    const result = await secureVerifiedAccount(client, admin, user, password);
    passwordSaved = result.passwordSaved;
    if (result.factorBlocked) {
      await client.auth.signOut({ scope: "local" }).catch(() => undefined);
      return { ok: false, status: 409, error: EMAIL_CODE_FACTOR_BLOCKED };
    }
    if (!result.secured || !result.recorded) {
      console.error(result.secured ? "Email code verified; password state not recorded" : "Email code verified; password or session update incomplete");
      await client.auth.signOut({ scope: "local" }).catch(() => undefined);
      return { ok: false, status: 503, error: "Email confirmed, but sign-in could not be completed. Request a new code and try again." };
    }
    session = result.session!;
  }
  return { ok: true, session: { access_token: session.access_token, refresh_token: session.refresh_token }, passwordUpdated, passwordSaved };
}
