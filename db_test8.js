const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    const users = await prisma.user.findMany({ select: { email: true }});
    console.log("Prisma Users:", users.map(u => u.email));
    
    const authUsers = await prisma.$queryRawUnsafe(`SELECT email FROM auth.users`);
    console.log("Auth Users:", authUsers.map(u => u.email));
  } catch(e) {
    console.error("Error:", e.message);
  }
}
main();
