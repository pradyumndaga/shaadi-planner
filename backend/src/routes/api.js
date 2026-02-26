const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');
const path = require('path');

const prisma = new PrismaClient();
const upload = multer({ dest: 'uploads/' });

router.use((req, res, next) => {
    console.log(`Router HIT: ${req.method} ${req.url}`);
    next();
});

// USER / ACCESS SHARE
router.get('/user/share-code', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.userId }, include: { sharedUsers: { select: { mobile: true } }, primaryUser: { select: { mobile: true } } } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        let code = user.shareCode;
        if (!code) {
            // Generate a 6-character alphanumeric code
            code = Math.random().toString(36).substring(2, 8).toUpperCase();
            await prisma.user.update({
                where: { id: req.userId },
                data: { shareCode: code }
            });
        }
        res.json({ shareCode: code, sharedUsers: user.sharedUsers, primaryUser: user.primaryUser });
    } catch (err) {
        console.error('Error fetching share code:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/user/join', async (req, res) => {
    try {
        const { shareCode } = req.body;

        // Handle disconnect
        if (!shareCode) {
            await prisma.user.update({
                where: { id: req.userId },
                data: { sharedWithId: null }
            });
            return res.json({ message: 'Disconnected from shared access' });
        }

        const primaryUser = await prisma.user.findUnique({ where: { shareCode: shareCode.toUpperCase() } });
        if (!primaryUser) {
            return res.status(404).json({ error: 'Invalid share code. No wedding found.' });
        }

        if (primaryUser.id === req.userId) {
            return res.status(400).json({ error: 'You cannot join your own wedding manually.' });
        }

        await prisma.user.update({
            where: { id: req.userId },
            data: { sharedWithId: primaryUser.id }
        });

        res.json({ message: `Successfully joined wedding linked to ${primaryUser.mobile}` });
    } catch (err) {
        console.error('Error joining wedding:', err);
        res.status(500).json({ error: err.message });
    }
});

// DASHBOARD STATS
router.post('/rooms/batch-allocate', async (req, res) => {
    console.log('HIT: /rooms/batch-allocate');
    try {
        const { allocations } = req.body;
        if (!Array.isArray(allocations)) return res.status(400).json({ error: 'Allocations must be an array' });

        const updates = allocations.map(a =>
            prisma.guest.update({
                where: { id: parseInt(a.guestId), userId: req.effectiveUserId },
                data: { roomId: a.roomId ? parseInt(a.roomId) : null }
            })
        );
        await prisma.$transaction(updates);
        res.json({ message: `Successfully updated ${allocations.length} allocations` });
    } catch (err) {
        console.error('Batch Allocate Error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const totalGuests = await prisma.guest.count({ where: { userId: req.effectiveUserId } });
        const guestsWithRooms = await prisma.guest.count({
            where: { userId: req.effectiveUserId, roomId: { not: null }, isTentative: false }
        });
        const tentativeGuests = await prisma.guest.count({
            where: { userId: req.effectiveUserId, isTentative: true }
        });
        const unnotifiedGuests = await prisma.guest.count({
            where: { userId: req.effectiveUserId, roomId: { not: null }, isNotified: false }
        });
        const totalRooms = await prisma.room.count({ where: { userId: req.effectiveUserId } });
        const rooms = await prisma.room.findMany({
            where: { userId: req.effectiveUserId },
            include: { guests: true }
        });

        let totalCapacity = 0;
        rooms.forEach(r => totalCapacity += r.capacity);

        // Finance
        const expenses = await prisma.finance.findMany({ where: { userId: req.effectiveUserId } });
        const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);

        res.json({
            totalGuests,
            tentativeGuests,
            visitingGuests: totalGuests - tentativeGuests,
            unassignedGuests: (totalGuests - tentativeGuests) - guestsWithRooms,
            totalRooms,
            totalCapacity,
            remainingCapacity: totalCapacity - guestsWithRooms,
            totalSpent,
            unnotifiedGuests
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GUESTS
router.get('/guests/unnotified', async (req, res) => {
    console.log('HIT: GET /guests/unnotified');
    try {
        const guests = await prisma.guest.findMany({
            where: { userId: req.effectiveUserId, roomId: { not: null }, isNotified: false },
            include: { room: true },
            orderBy: { name: 'asc' }
        });
        res.json(guests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/guests', async (req, res) => {
    console.log('HIT: GET /guests');
    try {
        const guests = await prisma.guest.findMany({
            where: { userId: req.effectiveUserId },
            include: { room: true, travelPlan: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(guests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/guests/notify', async (req, res) => {
    try {
        const { guestIds } = req.body;
        if (!Array.isArray(guestIds)) return res.status(400).json({ error: 'guestIds must be an array' });

        const guests = await prisma.guest.findMany({
            where: { id: { in: guestIds }, userId: req.effectiveUserId },
            include: { room: true }
        });

        for (const guest of guests) {
            if (guest.room) {
                console.log(`[SIMULATED SMS] To: ${guest.mobile} | Message: Dear ${guest.name}, your room for the wedding has been allocated: ${guest.room.name}. We look forward to seeing you!`);
            }
        }

        await prisma.guest.updateMany({
            where: { id: { in: guestIds }, userId: req.effectiveUserId },
            data: { isNotified: true }
        });

        res.json({ message: `Successfully notified ${guests.length} guests` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/guests', async (req, res) => {
    try {
        const { linkedArrivalGuestIds, linkedDepartureGuestIds, ...otherData } = req.body;
        const data = { ...otherData };
        if (data.arrivalTime) data.arrivalTime = new Date(data.arrivalTime);
        else data.arrivalTime = null;
        if (data.departureTime) data.departureTime = new Date(data.departureTime);
        else data.departureTime = null;

        // Force userId
        data.userId = req.effectiveUserId;

        const newGuest = await prisma.guest.create({
            data: data
        });

        // Apply linked arrivals
        if (Array.isArray(linkedArrivalGuestIds) && linkedArrivalGuestIds.length > 0) {
            await prisma.guest.updateMany({
                where: { id: { in: linkedArrivalGuestIds.map(id => parseInt(id)) }, userId: req.effectiveUserId },
                data: {
                    arrivalTime: data.arrivalTime,
                    arrivalFlightNo: data.arrivalFlightNo,
                    arrivalPnr: data.arrivalPnr
                }
            });
        }

        // Apply linked departures
        if (Array.isArray(linkedDepartureGuestIds) && linkedDepartureGuestIds.length > 0) {
            await prisma.guest.updateMany({
                where: { id: { in: linkedDepartureGuestIds.map(id => parseInt(id)) }, userId: req.effectiveUserId },
                data: {
                    departureTime: data.departureTime,
                    departureFlightNo: data.departureFlightNo,
                    departurePnr: data.departurePnr
                }
            });
        }

        res.json(newGuest);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/guests/:id', async (req, res) => {
    try {
        const { linkedArrivalGuestIds, linkedDepartureGuestIds, ...otherData } = req.body;
        const data = { ...otherData };
        // Sanitize dates: if empty string or invalid, set to null
        if (data.arrivalTime && data.arrivalTime !== '') {
            data.arrivalTime = new Date(data.arrivalTime);
        } else {
            data.arrivalTime = null;
        }

        if (data.departureTime && data.departureTime !== '') {
            data.departureTime = new Date(data.departureTime);
        } else {
            data.departureTime = null;
        }

        // Clean up any old fields that might be sent from frontend
        delete data.flightTrainNumber;
        delete data.pnr;
        delete data.id; // ensure ID isn't in body
        delete data.room; // ensure joined room isn't in body
        delete data.travelPlan;
        delete data.userId; // don't allow changing owner

        const updated = await prisma.guest.update({
            where: {
                id: parseInt(req.params.id),
                userId: req.effectiveUserId // Security check
            },
            data: data
        });

        // Apply linked arrivals
        if (Array.isArray(linkedArrivalGuestIds) && linkedArrivalGuestIds.length > 0) {
            await prisma.guest.updateMany({
                where: { id: { in: linkedArrivalGuestIds.map(id => parseInt(id)) }, userId: req.effectiveUserId },
                data: {
                    arrivalTime: data.arrivalTime,
                    arrivalFlightNo: data.arrivalFlightNo,
                    arrivalPnr: data.arrivalPnr
                }
            });
        }

        // Apply linked departures
        if (Array.isArray(linkedDepartureGuestIds) && linkedDepartureGuestIds.length > 0) {
            await prisma.guest.updateMany({
                where: { id: { in: linkedDepartureGuestIds.map(id => parseInt(id)) }, userId: req.effectiveUserId },
                data: {
                    departureTime: data.departureTime,
                    departureFlightNo: data.departureFlightNo,
                    departurePnr: data.departurePnr
                }
            });
        }

        res.json(updated);
    } catch (err) {
        console.error('Update Guest Error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/guests/:id', async (req, res) => {
    try {
        await prisma.guest.delete({
            where: {
                id: parseInt(req.params.id),
                userId: req.effectiveUserId
            }
        });
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/guests', async (req, res) => {
    try {
        await prisma.guest.deleteMany({ where: { userId: req.effectiveUserId } });
        res.json({ message: 'All guests deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/guests/bulk-delete', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids)) {
            return res.status(400).json({ error: 'IDs must be an array' });
        }

        await prisma.guest.deleteMany({
            where: {
                id: { in: ids.map(id => parseInt(id)) },
                userId: req.effectiveUserId
            }
        });

        res.json({ message: `${ids.length} guests deleted` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/guests/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }); // Get raw array of objects

        const guests = [];
        for (const row of data) {
            let rawName = row.Name || row.name || row['Name '] || row[' Name'] || '';
            let rawPhone = row.Phone || row.phone || row.Mobile || row.mobile || row['Phone '] || row[' Phone'] || '';
            let rawGender = row.Gender || row.gender || row.Sex || row.sex || row['Gender '] || row[' Gender'] || '';

            rawName = String(rawName).trim();
            rawPhone = String(rawPhone).trim();
            rawGender = String(rawGender).trim();

            // Normalize gender
            let finalGender = 'Other';
            if (/^m/i.test(rawGender)) finalGender = 'Male';
            else if (/^f/i.test(rawGender)) finalGender = 'Female';

            if (rawName && rawName !== '') {
                guests.push({
                    name: rawName,
                    mobile: rawPhone,
                    gender: finalGender,
                    userId: req.effectiveUserId // Scoped
                });
            }
        }

        if (guests.length === 0) return res.status(400).json({ error: 'No valid guest data found in file. Make sure your columns are labeled Name and Phone.' });

        const created = await prisma.guest.createMany({
            data: guests
        });

        res.json({ message: `Successfully uploaded ${created.count} guests`, count: created.count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ROOMS
router.get('/rooms', async (req, res) => {
    try {
        const rooms = await prisma.room.findMany({
            where: { userId: req.effectiveUserId },
            include: { guests: true },
            orderBy: { id: 'asc' }
        });
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/rooms', async (req, res) => {
    try {
        const newRoom = await prisma.room.create({
            data: {
                name: req.body.name,
                capacity: parseInt(req.body.capacity),
                userId: req.effectiveUserId
            }
        });
        res.json(newRoom);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/rooms/bulk', async (req, res) => {
    try {
        const count = parseInt(req.body.count || 0);
        const capacity = parseInt(req.body.capacity || 2);
        const prefix = req.body.prefix || 'Room';

        const currentRooms = await prisma.room.count({ where: { userId: req.effectiveUserId } });
        const roomsToCreate = [];
        for (let i = 1; i <= count; i++) {
            roomsToCreate.push({
                name: `${prefix} ${currentRooms + i}`,
                capacity: capacity,
                userId: req.effectiveUserId
            });
        }

        await prisma.room.createMany({ data: roomsToCreate });
        res.json({ message: `Created ${count} rooms` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETED DUPLICATE ROOM PUT ROUTE

router.put('/rooms/:id', async (req, res) => {
    try {
        const { hasExtraBed, capacity, name } = req.body;
        const data = {};
        if (hasExtraBed !== undefined) data.hasExtraBed = !!hasExtraBed;
        if (capacity !== undefined) data.capacity = parseInt(capacity);
        if (name !== undefined) data.name = name;

        const updated = await prisma.room.update({
            where: {
                id: parseInt(req.params.id),
                userId: req.effectiveUserId
            },
            data
        });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/rooms/:id', async (req, res) => {
    try {
        await prisma.room.delete({
            where: {
                id: parseInt(req.params.id),
                userId: req.effectiveUserId
            }
        });
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ALLOCATE GUEST TO ROOM
router.post('/rooms/allocate', async (req, res) => {
    try {
        const { guestId, roomId } = req.body;

        // if roomId is null, it means unassigning from room
        if (roomId === null) {
            const updated = await prisma.guest.update({
                where: {
                    id: parseInt(guestId),
                    userId: req.effectiveUserId
                },
                data: { roomId: null }
            });
            return res.json(updated);
        }

        const room = await prisma.room.findUnique({
            where: {
                id: parseInt(roomId),
                userId: req.effectiveUserId
            },
            include: { guests: true }
        });

        if (!room) return res.status(404).json({ error: 'Room not found' });

        const effectiveCapacity = room.capacity + (room.hasExtraBed ? 1 : 0);
        if (room.guests.length >= effectiveCapacity) {
            return res.status(400).json({ error: 'Room is full' });
        }

        const updatedGuest = await prisma.guest.update({
            where: {
                id: parseInt(guestId),
                userId: req.effectiveUserId
            },
            data: { roomId: parseInt(roomId) }
        });

        res.json(updatedGuest);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// EXPORT ROOM LAYOUT (EXCEL)
router.get('/rooms/export/excel', async (req, res) => {
    try {
        const rooms = await prisma.room.findMany({
            where: { userId: req.effectiveUserId },
            include: { guests: true }
        });
        const unassignedGuests = await prisma.guest.findMany({
            where: { userId: req.effectiveUserId, roomId: null }
        });

        const data = [];

        // Rooms section
        data.push(['ROOM LAYOUT']);
        data.push(['Room Name', 'Capacity', 'Current Occupancy', 'Guests']);

        rooms.forEach(room => {
            const guestNames = room.guests.map(g => g.name).join(', ');
            const effectiveCap = room.capacity + (room.hasExtraBed ? 1 : 0);
            data.push([room.name, effectiveCap, room.guests.length, guestNames]);
        });

        data.push([]); // spacer

        // Unassigned section
        data.push(['UNASSIGNED GUESTS (QUEUE)']);
        data.push(['Name', 'Mobile', 'Gender']);
        unassignedGuests.forEach(guest => {
            data.push([guest.name, guest.mobile, guest.gender]);
        });

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, "Room Layout");

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename="Room_Layout.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// EXPORT TRAVEL REPORT (EXCEL)
router.get('/guests/export/travel', async (req, res) => {
    try {
        const guests = await prisma.guest.findMany({ where: { userId: req.effectiveUserId } });

        const { mode } = req.query;
        const wb = xlsx.utils.book_new();

        // ARRIVALS SHEET
        if (!mode || mode === 'all' || mode === 'arrivals') {
            const arrivalsData = [['GUEST TRAVEL REPORT - ARRIVALS']];
            arrivalsData.push(['Flight/Train No', 'PNR', 'Arrival Time', 'Guest Name', 'Mobile']);

            const arrivingGuests = guests.filter(g => g.arrivalFlightNo || g.arrivalTime);
            const groupedArrivals = arrivingGuests.reduce((acc, g) => {
                const key = g.arrivalFlightNo || 'Private/Other';
                if (!acc[key]) acc[key] = [];
                acc[key].push(g);
                return acc;
            }, {});

            Object.keys(groupedArrivals).forEach(flightNo => {
                groupedArrivals[flightNo].forEach((g, idx) => {
                    arrivalsData.push([
                        idx === 0 ? flightNo : '',
                        g.arrivalPnr || '-',
                        idx === 0 ? (g.arrivalTime ? new Date(g.arrivalTime).toLocaleString() : '-') : '',
                        g.name,
                        g.mobile
                    ]);
                });
                arrivalsData.push([]); // spacer line
            });

            const arrivalsWs = xlsx.utils.aoa_to_sheet(arrivalsData);
            xlsx.utils.book_append_sheet(wb, arrivalsWs, "Arrivals");
        }

        // DEPARTURES SHEET
        if (!mode || mode === 'all' || mode === 'departures') {
            const departuresData = [['GUEST TRAVEL REPORT - DEPARTURES']];
            departuresData.push(['Flight/Train No', 'PNR', 'Departure Time', 'Guest Name', 'Mobile']);

            const departingGuests = guests.filter(g => g.departureFlightNo || g.departureTime);
            const groupedDepartures = departingGuests.reduce((acc, g) => {
                const key = g.departureFlightNo || 'Private/Other';
                if (!acc[key]) acc[key] = [];
                acc[key].push(g);
                return acc;
            }, {});

            Object.keys(groupedDepartures).forEach(flightNo => {
                groupedDepartures[flightNo].forEach((g, idx) => {
                    departuresData.push([
                        idx === 0 ? flightNo : '',
                        g.departurePnr || '-',
                        idx === 0 ? (g.departureTime ? new Date(g.departureTime).toLocaleString() : '-') : '',
                        g.name,
                        g.mobile
                    ]);
                });
                departuresData.push([]); // spacer line
            });

            const departuresWs = xlsx.utils.aoa_to_sheet(departuresData);
            xlsx.utils.book_append_sheet(wb, departuresWs, "Departures");
        }

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename="Travel_Report.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// EXPORT TRAVEL REPORT (PDF)
router.get('/guests/export/travel/pdf', async (req, res) => {
    try {
        const { mode } = req.query;
        const guests = await prisma.guest.findMany({ where: { userId: req.effectiveUserId } });
        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        const brandColor = '#4f46e5';
        const grayColor = '#6b7280';

        res.setHeader('Content-disposition', 'attachment; filename="Travel_Report.pdf"');
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);
        // HEADER
        const logoPath = path.join(__dirname, '../assets/wedding_sticker.png');
        try {
            doc.image(logoPath, 460, 45, { width: 80 });
        } catch (e) {
            console.error('Logo not found at:', logoPath);
        }

        doc.fillColor(brandColor).fontSize(24).font('Helvetica-Bold').text('ShaadiPlanner', { align: 'left' });
        doc.fillColor(grayColor).fontSize(10).font('Helvetica').text(`Travel Coordination Report • Generated ${new Date().toLocaleDateString()}`, { align: 'left' });
        doc.moveDown(1.5);

        let firstSectionAdded = false;

        // ARRIVALS
        if (!mode || mode === 'all' || mode === 'arrivals') {
            doc.fillColor(brandColor).fontSize(18).font('Helvetica-Bold').text('GUEST ARRIVALS', { underline: false });
            doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(brandColor).lineWidth(2).stroke();
            doc.moveDown(1);

            const arrivingGuests = guests.filter(g => g.arrivalFlightNo || g.arrivalTime);
            const groupedArrivals = arrivingGuests.reduce((acc, g) => {
                const key = g.arrivalFlightNo || 'Private/Other';
                if (!acc[key]) acc[key] = [];
                acc[key].push(g);
                return acc;
            }, {});

            if (Object.keys(groupedArrivals).length === 0) {
                doc.fillColor(grayColor).fontSize(11).font('Helvetica-Oblique').text('No arrival details recorded.');
                doc.moveDown();
            }

            Object.keys(groupedArrivals).forEach(flightNo => {
                const group = groupedArrivals[flightNo];
                const pnr = group[0].arrivalPnr || 'N/A';
                const time = group[0].arrivalTime ? new Date(group[0].arrivalTime).toLocaleString() : 'N/A';

                if (doc.y > 650) doc.addPage();
                const startY = doc.y;
                const headerHeight = 35;

                // Group Header Card
                doc.fillColor('#f3f4f6').rect(50, startY, 500, headerHeight).fill();
                doc.fillColor(brandColor).fontSize(12).font('Helvetica-Bold').text(flightNo, 60, startY + 8);
                doc.fillColor(grayColor).fontSize(10).font('Helvetica').text(`Time: ${time}`, 60, startY + 20);
                doc.y = startY + headerHeight + 5;

                group.forEach(g => {
                    if (doc.y > 750) {
                        doc.addPage();
                        doc.y = 50;
                    }
                    doc.fillColor('#1f2937').fontSize(11).font('Helvetica').text(`  • ${g.name} | ${g.mobile} | PNR: ${g.arrivalPnr || '-'}`, 75);
                });
                doc.moveDown(1.2);
            });
            firstSectionAdded = true;
        }

        // DEPARTURES
        if (!mode || mode === 'all' || mode === 'departures') {
            if (firstSectionAdded && (mode === 'all' || !mode)) doc.addPage();

            doc.fillColor(brandColor).fontSize(18).font('Helvetica-Bold').text('GUEST DEPARTURES', { underline: false });
            doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(brandColor).lineWidth(2).stroke();
            doc.moveDown(1);

            const departingGuests = guests.filter(g => g.departureFlightNo || g.departureTime);
            const groupedDepartures = departingGuests.reduce((acc, g) => {
                const key = g.departureFlightNo || 'Private/Other';
                if (!acc[key]) acc[key] = [];
                acc[key].push(g);
                return acc;
            }, {});

            if (Object.keys(groupedDepartures).length === 0) {
                doc.fillColor(grayColor).fontSize(11).font('Helvetica-Oblique').text('No departure details recorded.');
                doc.moveDown();
            }

            Object.keys(groupedDepartures).forEach(flightNo => {
                const group = groupedDepartures[flightNo];
                const pnr = group[0].departurePnr || 'N/A';
                const time = group[0].departureTime ? new Date(group[0].departureTime).toLocaleString() : 'N/A';

                if (doc.y > 650) doc.addPage();
                const startY = doc.y;
                const headerHeight = 35;

                // Group Header Card
                doc.fillColor('#f3f4f6').rect(50, startY, 500, headerHeight).fill();
                doc.fillColor(brandColor).fontSize(12).font('Helvetica-Bold').text(flightNo, 60, startY + 8);
                doc.fillColor(grayColor).fontSize(10).font('Helvetica').text(`Time: ${time}`, 60, startY + 20);
                doc.y = startY + headerHeight + 5;

                group.forEach(g => {
                    if (doc.y > 750) {
                        doc.addPage();
                        doc.y = 50;
                    }
                    doc.fillColor('#1f2937').fontSize(11).font('Helvetica').text(`  • ${g.name} | ${g.mobile} | PNR: ${g.departurePnr || '-'}`, 75);
                });
                doc.moveDown(1.2);
            });
        }

        doc.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// EXPORT ROOM LAYOUT (PDF)
router.get('/rooms/export/pdf', async (req, res) => {
    try {
        const rooms = await prisma.room.findMany({
            where: { userId: req.effectiveUserId },
            include: { guests: true }
        });
        const unassignedGuests = await prisma.guest.findMany({
            where: { userId: req.effectiveUserId, roomId: null }
        });

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const brandColor = '#4f46e5';
        const grayColor = '#6b7280';

        res.setHeader('Content-disposition', `attachment; filename="Room_Layout.pdf"`);
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

        // HEADER
        const logoPath = path.join(__dirname, '../assets/wedding_sticker.png');
        try {
            doc.image(logoPath, 460, 45, { width: 80 });
        } catch (e) {
            console.error('Logo not found at:', logoPath);
        }

        doc.fillColor(brandColor).fontSize(24).font('Helvetica-Bold').text('ShaadiPlanner', { align: 'left' });
        doc.fillColor(grayColor).fontSize(10).font('Helvetica').text(`Room Assignment Report • Generated ${new Date().toLocaleDateString()}`, { align: 'left' });
        doc.moveDown(1.5);

        doc.fillColor(brandColor).fontSize(18).font('Helvetica-Bold').text('ASSIGNED ROOMS', { underline: false });
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor(brandColor).lineWidth(2).stroke();
        doc.moveDown(1);

        rooms.forEach((room, index) => {
            const effectiveCap = room.capacity + (room.hasExtraBed ? 1 : 0);

            if (doc.y > 700) doc.addPage();

            const startY = doc.y;
            const headerHeight = 25;

            // Room Header Row
            doc.fillColor('#f3f4f6').rect(50, startY, 500, headerHeight).fill();

            doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold').text(room.name, 60, startY + 7);
            doc.fillColor(grayColor).fontSize(10).font('Helvetica').text(`Capacity: ${effectiveCap} ${room.hasExtraBed ? '[Extra Bed Active]' : ''}`, 300, startY + 8, { align: 'right', width: 240 });

            doc.y = startY + headerHeight + 5;

            if (room.guests.length > 0) {
                room.guests.forEach(g => {
                    if (doc.y > 750) {
                        doc.addPage();
                        doc.y = 50;
                    }
                    const genderLabel = g.gender === 'Male' ? '(M)' : g.gender === 'Female' ? '(F)' : '';
                    doc.fillColor('#374151').fontSize(11).font('Helvetica').text(`  • ${g.name} ${genderLabel} | ${g.mobile}`, 75);
                });
            } else {
                doc.fillColor(grayColor).fontSize(10).font('Helvetica-Oblique').text('No guests assigned to this room.', 75);
            }
            doc.moveDown(1.2);
        });

        const visitingUnassigned = unassignedGuests.filter(g => !g.isTentative);
        const tentativeUnassigned = unassignedGuests.filter(g => g.isTentative);

        if (visitingUnassigned.length > 0) {
            doc.addPage();
            doc.fillColor('#dc2626').fontSize(18).font('Helvetica-Bold').text('UNASSIGNED GUESTS (VISITING)', { underline: false });
            doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#dc2626').lineWidth(2).stroke();
            doc.moveDown(1);

            visitingUnassigned.forEach(guest => {
                doc.fillColor('#1f2937').fontSize(11).font('Helvetica').text(`  • ${guest.name.padEnd(30)} | ${guest.mobile} | ${guest.gender}`, { indent: 20 });
                doc.moveDown(0.3);
            });
        }

        if (tentativeUnassigned.length > 0) {
            doc.addPage();
            doc.fillColor('#f97316').fontSize(18).font('Helvetica-Bold').text('TENTATIVE INVITEES', { underline: false });
            doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#f97316').lineWidth(2).stroke();
            doc.moveDown(1);

            tentativeUnassigned.forEach(guest => {
                doc.fillColor('#1f2937').fontSize(11).font('Helvetica').text(`  • ${guest.name.padEnd(30)} | ${guest.mobile} | ${guest.gender}`, { indent: 20 });
                doc.moveDown(0.3);
            });
        }

        doc.end();
    } catch (err) {
        console.error('PDF Export Error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

// EXPORT FULL GUEST LIST (PDF)
router.get('/guests/export/all/pdf', async (req, res) => {
    try {
        const attendanceFilter = req.query.attendance || 'All';
        const whereClause = { userId: req.effectiveUserId };

        // Let's get the overall counts for the header regardless of the active filter
        const totalGuestsCount = await prisma.guest.count({ where: { userId: req.effectiveUserId } });
        const tentativeCount = await prisma.guest.count({ where: { userId: req.effectiveUserId, isTentative: true } });
        const visitingCount = totalGuestsCount - tentativeCount;

        // Apply active filter to the actual table data
        if (attendanceFilter === 'Visiting') whereClause.isTentative = false;
        if (attendanceFilter === 'Tentative') whereClause.isTentative = true;

        const guests = await prisma.guest.findMany({
            where: whereClause,
            include: { room: true }
        });

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const brandColor = '#4f46e5';
        const grayColor = '#6b7280';

        res.setHeader('Content-disposition', 'attachment; filename="Guest_List.pdf"');
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

        // HEADER
        const logoPath = path.join(__dirname, '../assets/wedding_sticker.png');
        try {
            doc.image(logoPath, 460, 45, { width: 80 });
        } catch (e) {
            console.error('Logo not found');
        }

        doc.fillColor(brandColor).fontSize(24).font('Helvetica-Bold').text('ShaadiPlanner', { align: 'left' });
        doc.fillColor(grayColor).fontSize(10).font('Helvetica').text(`Master Guest List • Generated ${new Date().toLocaleDateString()}`, { align: 'left' });
        doc.moveDown(1.5);

        doc.fillColor(brandColor).fontSize(18).font('Helvetica-Bold').text('GUEST LIST', { underline: false });
        doc.fillColor(grayColor).fontSize(10).font('Helvetica').text(`Filter: ${attendanceFilter}`);
        doc.moveDown(0.5);

        // Summary Counts Box
        doc.fillColor('#f8fafc').rect(50, doc.y, 500, 40).fill();
        doc.strokeColor('#e2e8f0').lineWidth(1).rect(50, doc.y, 500, 40).stroke();

        const summaryY = doc.y + 15;
        doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold');

        doc.text(`Total Guests:`, 70, summaryY, { continued: true }).font('Helvetica').text(` ${totalGuestsCount}`, { continued: false });
        doc.font('Helvetica-Bold').text(`Visiting:`, 240, summaryY, { continued: true }).font('Helvetica').text(` ${visitingCount}`, { continued: false });
        doc.font('Helvetica-Bold').text(`Tentative:`, 400, summaryY, { continued: true }).font('Helvetica').text(` ${tentativeCount}`, { continued: false });

        doc.y += 40;
        doc.moveDown(1);

        // Table Header
        const startY = doc.y;
        doc.fillColor('#f3f4f6').rect(50, startY, 500, 25).fill();
        doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold');
        doc.text('#', 60, startY + 7);
        doc.text('Name', 90, startY + 7);
        doc.text('Mobile', 240, startY + 7);
        doc.text('Attendance', 330, startY + 7);
        doc.text('Room', 420, startY + 7);
        doc.y = startY + 30;

        guests.forEach((g, index) => {
            if (doc.y > 750) {
                doc.addPage();
                // Repeat Header on new page
                const newPageY = 50;
                doc.fillColor('#f3f4f6').rect(50, newPageY, 500, 25).fill();
                doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold');
                doc.text('#', 60, newPageY + 7);
                doc.text('Name', 90, newPageY + 7);
                doc.text('Mobile', 240, newPageY + 7);
                doc.text('Attendance', 330, newPageY + 7);
                doc.text('Room', 420, newPageY + 7);
                doc.y = newPageY + 30;
            }

            // Alternating background for rows
            if (index % 2 === 1) {
                doc.fillColor('#f9fafb').rect(50, doc.y - 2, 500, 20).fill();
            }

            const currentY = doc.y;
            doc.fillColor('#374151').fontSize(10).font('Helvetica');
            doc.text(`${index + 1}`, 60, currentY, { lineBreak: false });

            // Truncate name to prevent wrapping
            const safeName = g.name.length > 25 ? g.name.substring(0, 25) + '...' : g.name;
            doc.text(safeName, 90, currentY, { lineBreak: false });

            doc.text(g.mobile || '-', 240, currentY, { lineBreak: false });

            const attendanceStr = g.isTentative ? 'Tentative' : 'Visiting';
            doc.text(attendanceStr, 330, currentY, { lineBreak: false });

            const roomStr = g.room ? (g.room.name.length > 20 ? g.room.name.substring(0, 20) + '...' : g.room.name) : '-';
            doc.text(roomStr, 420, currentY, { lineBreak: false });

            doc.y = currentY + 20;
        });

        doc.end();
    } catch (err) {
        console.error('PDF Export Error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

// FINANCE
router.get('/finance', async (req, res) => {
    try {
        const expenses = await prisma.finance.findMany({
            where: { userId: req.effectiveUserId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(expenses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/finance', async (req, res) => {
    try {
        const exp = await prisma.finance.create({
            data: {
                category: req.body.category,
                amount: parseFloat(req.body.amount),
                description: req.body.description,
                userId: req.effectiveUserId
            }
        });
        res.json(exp);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
