const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const unnotified = await prisma.guest.findMany({ where: { roomId: { not: null }, isNotified: false } });
    console.log(unnotified.map(g => `Guest: ${g.name}, UserID: ${g.userId}`));
}
run().finally(() => prisma.$disconnect());
