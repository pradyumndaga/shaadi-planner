const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const users = await prisma.user.findMany();
    for (const u of users) {
        const effectiveUserId = u.sharedWithId || u.id;
        const totalGuests = await prisma.guest.count({ where: { userId: effectiveUserId } });
        const unnotifiedGuests = await prisma.guest.count({
            where: { userId: effectiveUserId, roomId: { not: null }, isNotified: false }
        });
        console.log(`User ID: ${u.id}, Effective ID: ${effectiveUserId}, Unnotified Count: ${unnotifiedGuests}, Total Guests: ${totalGuests}`);
    }
}
run().finally(() => prisma.$disconnect());
