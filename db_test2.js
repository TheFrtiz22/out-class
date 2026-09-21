const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    const res = await prisma.$executeRawUnsafe(`
      INSERT INTO public."User" (id, email, role, "createdAt")
      VALUES ('test-uuid', 'test@virginia.edu', 'STUDENT', NOW());
    `);
    console.log("Success:", res);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
main();
