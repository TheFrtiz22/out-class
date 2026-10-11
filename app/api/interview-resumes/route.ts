import { requireAuth } from "@/utils/auth";
import { prisma } from "@/utils/prisma";
import { authorizeInterview, interviewTransactionOptions } from "@/utils/interview-access";
import { interviewScopeSchema } from "@/lib/interview-access";
import { z } from "zod";

/** No storage capability is returned. Every PDF/thumbnail/range fetch is reauthorized. */
export async function GET(request: Request) {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = interviewScopeSchema.extend({ documentId: z.string().uuid() }).safeParse(query);
  if (!parsed.success) return new Response("Invalid document request", { status: 400 });
  try {
    const { user } = await requireAuth();
    const bytes = await prisma.$transaction(async tx => {
      await authorizeInterview(tx, parsed.data, user.id, "resume", "share");
      const document = await tx.interviewResumeDocument.findFirst({ where: { id: parsed.data.documentId, applicationId: parsed.data.applicationId, roundId: parsed.data.roundId }, select: { content: true } });
      if (!document) throw new Error("Unavailable");
      return document.content;
    }, interviewTransactionOptions);
    const headers = new Headers({ "Content-Type": "application/pdf", "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "Content-Disposition": 'inline; filename="interview-resume.pdf"', "Accept-Ranges": "bytes" });
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      const start = match ? Number(match[1]) : -1;
      const end = match?.[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
      if (!match || start < 0 || start >= bytes.length || end < start) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${bytes.length}`, "Cache-Control": "private, no-store" } });
      headers.set("Content-Range", `bytes ${start}-${end}/${bytes.length}`);
      headers.set("Content-Length", String(end - start + 1));
      return new Response(new Uint8Array(bytes.slice(start, end + 1)), { status: 206, headers });
    }
    headers.set("Content-Length", String(bytes.length));
    return new Response(new Uint8Array(bytes), { headers });
  } catch {
    return new Response("Document unavailable", { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }
}
