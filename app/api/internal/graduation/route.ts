import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/utils/prisma";
import { runGraduationJob } from "@/utils/graduation";

export const runtime = "nodejs";
export const maxDuration = 60;
// Daily (vercel.json). Marks graduates and their memberships as alumni; sends nothing.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await runGraduationJob(prisma, new Date(), { profiles: 500, memberships: 500, deadline: Date.now() + 40_000 });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Graduation update unavailable. It runs again tomorrow." }, { status: 503 }); }
}

// Vercel Cron invokes GET with the same bearer-secret check as POST.
export const GET = POST;
