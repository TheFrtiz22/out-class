import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/utils/auth";
import { auditSupportAction } from "@/utils/support-audit";
import { storagePathSchema } from "@/lib/student-profile";
import { profilePhotoSource } from "@/lib/profile-photo";
import { prisma } from "@/utils/prisma";
import { authorizeCrmPhoto } from "@/lib/crm-photo-authorization";
import { getApplicantDisplay } from "@/actions/applicant-intelligence";
import { getInterviewApplicantPanel } from "@/actions/interview-resumes";
import { getEvaluations } from "@/actions/evaluations";
const input = z.object({ path: storagePathSchema.refine(v => !!v), clubId: z.string().uuid().optional(), applicationId: z.string().uuid().optional(), roundId: z.string().uuid().optional(), sessionId: z.string().uuid().optional(), mode: z.enum(["evaluation", "preview", "crm"]).optional() }).strict();
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
export async function GET(request: Request) {
  const parsed = input.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return new NextResponse("Invalid request", { status: 400, headers });
  try {
    const { user } = await requireAuth();
    const d = parsed.data;
    if (d.path.split("/")[0] !== user.id) {
      if (!d.clubId || !d.applicationId) return new NextResponse("Forbidden", { status: 403, headers });
      const scope = { clubId: d.clubId, applicationId: d.applicationId, ...(d.roundId ? { roundId: d.roundId } : {}), ...(d.sessionId ? { sessionId: d.sessionId } : {}), ...(d.mode ? { mode: d.mode } : {}) };
      const expected = profilePhotoSource(d.path, scope);
      let permitted = false;
      if (d.mode === "crm") {
        if (d.roundId || d.sessionId) return new NextResponse("Forbidden", { status: 403, headers });
        permitted = await prisma.$transaction(tx => authorizeCrmPhoto(tx, user.id, d.clubId!, d.applicationId!, d.path));
      } else if (d.mode === "evaluation") {
        const result = await getEvaluations(d.clubId, d.applicationId);
        permitted = result.evaluations.some(e => e.interviewer.user.studentProfile?.headshotUrl === expected);
      } else if (d.roundId) {
        const result = await getInterviewApplicantPanel({ clubId: d.clubId, applicationId: d.applicationId, roundId: d.roundId });
        permitted = result.profile?.headshotUrl === expected;
      } else {
        const result = await getApplicantDisplay({ clubId: d.clubId, applicationId: d.applicationId, ...(d.sessionId ? { sessionId: d.sessionId } : {}), ...(d.mode === "preview" ? { previewConfig: { version: 1, fields: ["photo"] } } : {}) });
        permitted = result.photo === expected;
      }
      if (!permitted) return new NextResponse("Forbidden", { status: 403, headers });
    }
    const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) return new NextResponse("Photo storage unavailable", { status: 503, headers });
    const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", secret, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
    const { data: bucket, error: bucketError } = await storage.getBucket("headshots");
    if (bucketError || !bucket || bucket.public) return new NextResponse("Private photo storage unavailable", { status: 503, headers });
    await auditSupportAction("platform.impersonation.photo-read", user.id);
    const { data, error } = await storage.from("headshots").download(d.path);
    if (error || !data || data.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(data.type)) return new NextResponse("Not found", { status: 404, headers });
    return new NextResponse(await data.arrayBuffer(), { headers: { ...headers, "Content-Type": data.type } });
  } catch (error) {
    const redirect = error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT");
    return new NextResponse(redirect ? "Unauthorized" : "Forbidden", { status: redirect ? 401 : 403, headers });
  }
}
