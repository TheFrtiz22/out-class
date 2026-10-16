import "server-only";
import { prisma } from "@/utils/prisma";
import { privateFlyerStorage } from "@/utils/event-flyer-storage";
/** Durable queue includes replacements, explicit removals and cascading event deletes. */
export async function cleanupEventFlyers() {
  const rows = await prisma.$queryRaw<{ path: string }[]>`SELECT path FROM "EventFlyerDeletion" ORDER BY "createdAt" LIMIT 100`;
  if (!rows.length) return;
  const storage = await privateFlyerStorage();
  for (const { path } of rows) {
    const { error } = await storage.remove([path]);
    if (!error) await prisma.$executeRaw`DELETE FROM "EventFlyerDeletion" WHERE path=${path}`;
  }
}
