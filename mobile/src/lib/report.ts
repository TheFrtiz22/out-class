import { config } from "~/lib/config";

/**
 * Error reporting seam. Sentry is wired here once a DSN is provisioned (docs/mobile/OWNER_QUEUE.md);
 * until then errors are logged in development only. Like the web's allowlist (lib/sentry-scrub.ts),
 * only the error class and a fixed context word leave the device: never messages, input, tokens or
 * scanned codes.
 */
export function reportError(error: unknown, context: "render" | "api" | "scan" | "push" | "upload") {
  const name = error instanceof Error ? error.name : typeof error;
  if (__DEV__) console.warn(`[outclass:${context}] ${name}`);
  if (!config.sentryDsn) return;
  // Sentry.captureException(new Error(name), { tags: { context } }) once @sentry/react-native is added.
}
