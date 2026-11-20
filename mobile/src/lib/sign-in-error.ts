import { config } from "~/lib/config";

/** What a failed password sign-in means for the person on the sign-in screen. */
export type SignInFailure = { message: string; needsCaptcha: boolean };

type AuthErrorLike = { name?: string; message?: string; status?: number; code?: string } | null | undefined;

/** Supabase refused a sign-in that carried no Turnstile token (docs/turnstile.md, stage 2). */
export function captchaRequired(error: AuthErrorLike) {
  return !!error && (error.code === "captcha_failed" || /captcha/i.test(error.message ?? ""));
}

/** The app was started without a Supabase address (no EXPO_PUBLIC_* and no config.local.json override). */
export function missingConfigMessage(current: { supabaseUrl: string; supabasePublishableKey: string } = config) {
  if (current.supabaseUrl && current.supabasePublishableKey) return null;
  return "This copy of the app has no sign-in server set. Pull the latest main, or set supabaseUrl and supabasePublishableKey in mobile/config.local.json (see config.example.json), then restart Expo.";
}

/**
 * The web's wording (app/login) for a failed sign-in. Supabase's own messages are not shown to
 * people, except in a development build, where the real error follows so a setup problem is never
 * hidden behind "try again".
 */
export function signInFailure(error: NonNullable<AuthErrorLike>, dev: boolean = typeof __DEV__ !== "undefined" && __DEV__): SignInFailure {
  const needsCaptcha = captchaRequired(error);
  let message: string;
  if (needsCaptcha) message = "One more check is needed before you can sign in.";
  else if (error.status === 400 || error.code === "invalid_credentials") message = "That email or password isn't right.";
  else if (error.status === 429) message = "Too many attempts. Wait a moment and try again.";
  // supabase-js reports a request that never reached the server (offline, bad address) with status 0.
  else if (!error.status || error.name === "AuthRetryableFetchError") message = "We couldn't reach OutClass. Check your connection and try again.";
  else message = "We couldn't sign you in just now. Try again in a moment.";
  if (dev) {
    const detail = [error.name, error.status ? `status ${error.status}` : null, error.code, error.message].filter(Boolean).join(" · ");
    if (detail) message += `\n\nDev details: ${detail}`;
  }
  return { message, needsCaptcha };
}
