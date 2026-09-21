const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO public."User" (id, email, role, "createdAt")
      VALUES ('new-uuid-123', 'bsb4rd@virginia.edu', 'STUDENT', NOW())
      ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id;
    `);
    console.log("Upsert succeeded");
  } catch(e) {
    console.error("Error:", e.message);
  }
}
main();
