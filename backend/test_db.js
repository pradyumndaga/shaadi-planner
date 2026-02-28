const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const guests = await prisma.guest.findMany({
    orderBy: { id: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(guests, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
