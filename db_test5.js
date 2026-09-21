const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    const users = await prisma.user.findMany({ take: 5 });
    console.log("Users:", users);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
main();
