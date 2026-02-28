const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    console.log("--- Users ---");
    const users = await prisma.user.findMany();
    for (const u of users) {
        const unnotifiedCount = await prisma.guest.count({
            where: { userId: u.id, roomId: { not: null }, isNotified: false }
        });
        const totalGuests = await prisma.guest.count({ where: { userId: u.id } });
        console.log(`User ID: ${u.id}, Mobile: ${u.mobile}, Total Guests: ${totalGuests}, Unnotified: ${unnotifiedCount}`);
    }
}
run().finally(() => prisma.$disconnect());
