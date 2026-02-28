const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const total = await prisma.guest.count();
    const withRooms = await prisma.guest.count({ where: { roomId: { not: null } } });
    const unnotified = await prisma.guest.count({ where: { roomId: { not: null }, isNotified: false } });
    console.log(`Total: ${total}, With Rooms: ${withRooms}, Unnotified: ${unnotified}`);
}
run().finally(() => prisma.$disconnect());
