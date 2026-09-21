const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    const res = await prisma.$queryRawUnsafe(`
      SELECT * FROM auth.users ORDER BY created_at DESC LIMIT 5;
    `);
    console.log("Auth users:", res.map(u => u.email));
  } catch(e) {
    console.error("Error:", e.message);
  }
}
main();
