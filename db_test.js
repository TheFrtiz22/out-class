const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  try {
    const res = await prisma.$queryRaw`SELECT enum_range(NULL::"AppRole")`;
    console.log("AppRole enum:", res);
  } catch(e) {
    console.error(e);
  }
}
main();
