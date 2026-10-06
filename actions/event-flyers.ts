"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireClubPermission } from "@/utils/auth";
import { prisma } from "@/utils/prisma";
import { privateFlyerStorage } from "@/utils/event-flyer-storage";
import { validateProfileFile } from "@/lib/student-profile";
import { auditSupportAction } from "@/utils/support-audit";
import { revalidatePath, revalidateTag } from "next/cache";
export async function uploadEventFlyer(input: FormData) {
  if (
    [...input.keys()].some(
      (k) => !["eventId", "clubId", "revision", "file"].includes(k),
    ) ||
    ["eventId", "clubId", "revision", "file"].some(
      (k) => input.getAll(k).length !== 1,
    )
  )
    throw Error("Provide one event, revision, club and file.");
  const eventId = z.string().uuid().parse(input.get("eventId")),
    clubId = z.string().uuid().parse(input.get("clubId")),
    revision = z.coerce.number().int().min(0).parse(input.get("revision"));
  const { user } = await requireClubPermission(clubId, ["meetings.manage"]);
  const file = input.get("file");
  if (!file || typeof file === "string" || file.size > 5242880)
    throw Error("Choose a JPEG, PNG or WebP up to 5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer()),
    mime = validateProfileFile(bytes, file.type, "headshot");
  const ext =
    mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
  const path = `${clubId}/${eventId}/${randomUUID()}.${ext}`;
  // Lock before issuing Storage capabilities; edits/submissions cannot race the attachment.
  let uploadedStorage: Awaited<ReturnType<typeof privateFlyerStorage>> | null =
    null;
  let result: { revision: number };
  try {
    result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Event" WHERE id=${eventId} FOR UPDATE`;
        const e = await tx.meeting.findFirst({
          where: { id: eventId, clubId },
          include: { publication: true },
        });
        if (
          !e?.publication ||
          e.revision !== revision ||
          ["CANCELLED", "ARCHIVED"].includes(e.publication.status)
        )
          throw Error(
            "Event changed or is unavailable. Reload before uploading.",
          );
        const storage = await privateFlyerStorage();
        await auditSupportAction(
          "platform.impersonation.event-flyer-upload",
          eventId,
        );
        const { error } = await storage.upload(path, bytes, {
          contentType: mime,
          upsert: false,
          cacheControl: "0",
        });
        if (error)
          throw Error(
            "Could not upload flyer. Your saved event has not changed.",
          );
        uploadedStorage = storage;
        await tx.eventFlyer.create({
          data: {
            id: randomUUID(),
            eventId,
            path,
            mime,
            size: bytes.length,
            createdBy: user.id,
          },
        });
        const flyer = await tx.eventFlyer.findUniqueOrThrow({
          where: { path },
          select: { id: true },
        });
        await tx.meeting.update({
          where: { id: eventId },
          data: { revision: { increment: 1 } },
        });
        await tx.eventPublication.update({
          where: { eventId },
          data: {
            flyerId: flyer.id,
            status: "DRAFT",
            approvedRevision: null,
            publishedAt: null,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "event.flyer.upload",
            targetId: eventId,
            clubId,
            details: { mime, size: bytes.length },
          },
        });
        return { revision: revision + 1 };
      },
      { timeout: 20000 },
    );
  } catch (error) {
    // A failed transaction cannot leave a referenced flyer. Remove its new private object.
    if (uploadedStorage)
      await (uploadedStorage as Awaited<ReturnType<typeof privateFlyerStorage>>)
        .remove([path])
        .catch(() => {});
    throw error;
  }
  revalidatePath("/corkboard");
  revalidatePath("/");
  revalidateTag("club-directory");
  return result;
}
