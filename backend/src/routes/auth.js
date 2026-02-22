const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'wedding-secret-key-123';

// signup
router.post('/signup', async (req, res) => {
    try {
        const { mobile, password } = req.body;

        // Indian mobile validation (10 digits, starts with 6-9)
        const mobileRegex = /^[6-9]\d{9}$/;
        if (!mobileRegex.test(mobile)) {
            return res.status(400).json({ error: 'Invalid Indian mobile number. Please enter a 10-digit number starting with 6-9.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        }

        const existingUser = await prisma.user.findUnique({ where: { mobile } });
        if (existingUser) {
            return res.status(400).json({ error: 'Mobile number already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                mobile,
                password: hashedPassword
            }
        });

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, mobile: user.mobile } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// login
router.post('/login', async (req, res) => {
    try {
        const { mobile, password } = req.body;

        const user = await prisma.user.findUnique({ where: { mobile } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid mobile number or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid mobile number or password.' });
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, mobile: user.mobile } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
