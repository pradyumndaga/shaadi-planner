const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    let room = await prisma.room.findFirst({ where: { userId: 1 } });
    if (!room) {
        room = await prisma.room.create({
            data: { name: 'Suite 101', capacity: 2, userId: 1 }
        });
    }
    await prisma.guest.create({
        data: { 
            name: 'Test Guest', 
            mobile: '919000000001', 
            userId: 1, 
            roomId: room.id, 
            isNotified: false,
            gender: 'Male'
        }
    });
    console.log("Created test guest for userId 1 assigned to room", room.name);
}
run().finally(() => prisma.$disconnect());
