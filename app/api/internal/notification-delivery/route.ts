import { timingSafeEqual } from "node:crypto";
import { processNotificationEmails } from "@/utils/notification-delivery";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let result;
  try { result = await processNotificationEmails(10); }
  catch { return Response.json({ error: "Notification email delivery unavailable. Queued work is retained." }, { status: 503 }); }
  // Web Push (S1-8) runs after email and can never fail the email response.
  let push;
  try { push = await (await import("@/utils/notification-push")).processNotificationPushes(50); }
  catch { push = { enabled: true, error: "PUSH_UNAVAILABLE" }; }
  return Response.json({ ...result, push }, { headers: { "Cache-Control": "no-store" } });
}
export const GET = POST;
