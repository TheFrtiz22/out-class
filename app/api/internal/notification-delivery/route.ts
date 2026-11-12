import { timingSafeEqual } from "node:crypto";
import { processNotificationEmails } from "@/utils/notification-delivery";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const startedAt = Date.now();
  let result;
  try { result = await processNotificationEmails(10); }
  catch { return Response.json({ error: "Notification email delivery unavailable. Queued work is retained." }, { status: 503 }); }
  // Web Push (S1-8) runs after email, inside the same 60 s budget, and can never fail the email response.
  let push;
  try { push = await (await import("@/utils/notification-push")).processNotificationPushes(50, { startedAt }); }
  catch (error) { push = { enabled: true, error: "PUSH_UNAVAILABLE" }; reportPushFailure(error); }
  return Response.json({ ...result, push }, { headers: { "Cache-Control": "no-store" } });
}
export const GET = POST;

// Vercel logs get a bounded code; Sentry (when a DSN is set) gets the exception through the
// existing scrubbed server client (sentry.server.config.ts).
function reportPushFailure(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  console.error("notification-push unavailable", { code: typeof code === "string" && /^[A-Z0-9_]{1,20}$/.test(code) ? code : error instanceof Error ? error.name : "UNKNOWN" });
  if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) void import("@sentry/nextjs").then(Sentry => { Sentry.captureException(error, { tags: { worker: "notification-push" } }) }).catch(() => {});
}
