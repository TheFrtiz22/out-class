import { timingSafeEqual } from "node:crypto";
import { processNotificationEmails } from "@/utils/notification-delivery";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try { return Response.json(await processNotificationEmails(10), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "Notification email delivery unavailable. Queued work is retained." }, { status: 503 }); }
}
export const GET = POST;
