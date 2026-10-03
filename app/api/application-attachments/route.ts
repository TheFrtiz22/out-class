import { auditSupportAction } from "@/utils/support-audit";
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth } from "@/utils/auth"
import { prisma } from "@/utils/prisma"
import { isApplicationStoragePath } from "@/lib/student-applications"
import { createClient } from "@supabase/supabase-js"

const querySchema = z.object({ applicationId: z.string().uuid(), questionId: z.string().uuid() })
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" }
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const parsed = querySchema.safeParse({ applicationId: params.get("applicationId"), questionId: params.get("questionId") })
  if (!parsed.success) return new NextResponse("Invalid attachment reference", { status: 400, headers })
  try {
    const { user } = await requireAuth()
    // Bind the read to the saved answer, not a caller-supplied path or the current profile resume.
    const answer = await prisma.applicationAnswer.findFirst({
      where: {
        ...parsed.data,
        question: { type: "FILE_UPLOAD" },
        application: { OR: [
          { studentId: user.id },
          { status: { not: "DRAFTING" }, round: { anonymousReview: false }, club: { members: { some: {
            userId: user.id, status: "ACTIVE", OR: [{ isOwner: true }, { permissions: { has: "applicants.identify" } }],
          } } } },
        ] },
      },
      select: { response: true, question: { select: { clubId: true } }, application: { select: { studentId: true, clubId: true } } },
    })
    if (!answer || answer.question.clubId !== answer.application.clubId || !isApplicationStoragePath(answer.response) ||
        !answer.response.startsWith(`${answer.application.studentId}/`))
      return new NextResponse("Not found", { status: 404, headers })
    const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!secret) return new NextResponse("Storage unavailable", { status: 503, headers })
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", secret)
    const { data: bucket, error: bucketError } = await admin.storage.getBucket("resumes")
    if (bucketError || !bucket || bucket.public) return new NextResponse("Private storage unavailable", { status: 503, headers })
    await auditSupportAction("platform.impersonation.attachment-read", user.id);
    const { data, error } = await admin.storage.from("resumes").createSignedUrl(answer.response, 300, { download: true })
    if (error || !data?.signedUrl) return new NextResponse("Not found", { status: 404, headers })
    return NextResponse.redirect(data.signedUrl, { headers })
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT")) throw error
    return new NextResponse("Attachment unavailable", { status: 500, headers })
  }
}
