/** Run in a trusted server job with the same database/storage environment as the app. */
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const prisma = new PrismaClient();
async function main() {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !process.env.NEXT_PUBLIC_SUPABASE_URL) throw Error('Storage configuration missing');
  const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, secret, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from('event-flyers');
  // Unique paths are never reused. A failed deletion remains queued for the next run.
  const rows = await prisma.$queryRaw`SELECT path FROM "EventFlyerDeletion" ORDER BY "createdAt" LIMIT 1000`;
  for (const { path } of rows) {
    const { error } = await storage.remove([path]);
    if (error) throw Error('Flyer deletion failed; remaining work retained for retry');
    await prisma.$executeRaw`DELETE FROM "EventFlyerDeletion" WHERE path=${path}`;
  }
  console.log(`Removed ${rows.length} queued event flyers`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
