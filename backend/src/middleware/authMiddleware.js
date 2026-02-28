const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'wedding-secret-key-123';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authMiddleware = async (req, res, next) => {
    let token = '';
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    // Is it a short-lived download token from the query string?
    if (req.query.token && token === req.query.token) {
        const tokenService = require('./downloadTokenService');
        const dUserId = tokenService.validateDownloadToken(token);

        if (!dUserId) {
            return res.status(401).json({ error: 'Unauthorized: Invalid or expired download token' });
        }

        // A download token simply grants read-only access to the bound effectiveUserId
        req.userId = dUserId;
        req.effectiveUserId = dUserId;
        req.isReadOnly = true;
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized: User not found' });
        }

        req.user = user;
        req.userId = parseInt(user.id, 10);
        req.effectiveUserId = parseInt(user.sharedWithId || user.id, 10);
        // A shared user who has readOnly=true cannot mutate data
        req.isReadOnly = !!(user.sharedWithId && user.readOnly);

        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

module.exports = authMiddleware;
