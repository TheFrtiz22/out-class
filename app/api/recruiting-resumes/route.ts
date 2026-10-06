import { z } from "zod";
import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { authorizeRecruitingResume } from "@/utils/recruiting-resume";
import { createClient } from "@supabase/supabase-js";
import { validateProfileFile } from "@/lib/student-profile";
import { auditSupportAction } from "@/utils/support-audit";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const input = z.object({ clubId: z.string().uuid(), applicationId: z.string().uuid() }).safeParse({ clubId: url.searchParams.get("clubId"), applicationId: url.searchParams.get("applicationId") });
  const headers = { "Cache-Control": "private, no-store", "Content-Type": "application/pdf", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Disposition": 'inline; filename="resume.pdf"' };
  if (!input.success || url.searchParams.has("path")) return new Response("Invalid scope", { status: 400, headers: { "Cache-Control": "private, no-store" } });
  try {
    const { user } = await requireAuth();
    const authorize = () => prisma.$transaction(tx => authorizeRecruitingResume(tx, input.data.clubId, input.data.applicationId, user.id));
    const path = await authorize();
    const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) return new Response("Storage unavailable", { status: 503 });
    const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", secret, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
    const bucket = await storage.getBucket("resumes");
    if (bucket.error || !bucket.data || bucket.data.public) return new Response("Storage unavailable", { status: 503 });
    const result = await storage.from("resumes").download(path);
    if (result.error || !result.data) return new Response("Resume unavailable", { status: 404 });
    const bytes = new Uint8Array(await result.data.arrayBuffer()); validateProfileFile(bytes, result.data.type, "resume");
    if (await authorize() !== path) throw Error("Unavailable");
    await auditSupportAction("platform.impersonation.resume-read", user.id);
    return new Response(bytes, { headers });
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
    return new Response("Resume unavailable", { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }
}
