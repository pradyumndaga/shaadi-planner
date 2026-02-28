const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    let room = await prisma.room.create({
        data: { name: 'Suite 101', capacity: 2, userId: 1 }
    });
    await prisma.guest.create({
        data: { name: 'John Doe', mobile: '919876543210', userId: 1, roomId: room.id, isNotified: false }
    });
    console.log("Created test room and guest for userId 1");
}
run().finally(() => prisma.$disconnect());
