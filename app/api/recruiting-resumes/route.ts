import { z } from "zod";
import { requireAuth } from "@/utils/auth";
import { readRecruitingResume } from "@/utils/recruiting-resume";
import { ProfileFieldHiddenError } from "@/lib/profile-field-visibility";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const input = z.object({ clubId: z.string().uuid(), applicationId: z.string().uuid() }).safeParse({ clubId: url.searchParams.get("clubId"), applicationId: url.searchParams.get("applicationId") });
  const headers = { "Cache-Control": "private, no-store", "Content-Type": "application/pdf", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Disposition": 'inline; filename="resume.pdf"' };
  if (!input.success || url.searchParams.has("path")) return new Response("Invalid scope", { status: 400, headers: { "Cache-Control": "private, no-store" } });
  try {
    const { user } = await requireAuth();
    const result = await readRecruitingResume(input.data.clubId, input.data.applicationId, user.id);
    if (!result.ok) return new Response(result.status === 503 ? "Storage unavailable" : "Resume unavailable", { status: result.status });
    return new Response(result.bytes, { headers });
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
    if (error instanceof ProfileFieldHiddenError) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
    return new Response("Resume unavailable", { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }
}
