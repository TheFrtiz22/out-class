const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    const res = await prisma.$queryRaw`SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user'`;
    console.log("Trigger source:\n", res[0].prosrc);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
main();
