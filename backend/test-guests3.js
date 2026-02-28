const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const user1Guests = await prisma.guest.findMany({ where: { userId: 1 }, take: 3 });
    const user1Room = await prisma.room.findFirst({ where: { userId: 1 } });
    
    if (user1Room && user1Guests.length > 0) {
        for (const guest of user1Guests) {
            await prisma.guest.update({
                where: { id: guest.id },
                data: { roomId: user1Room.id, isNotified: false }
            });
            console.log(`Assigned user 1 guest ${guest.name} to room ${user1Room.name}`);
        }
    } else {
        console.log("No guests or rooms found for user 1");
    }
}
run().finally(() => prisma.$disconnect());
