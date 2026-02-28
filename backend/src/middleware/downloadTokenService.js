const crypto = require('crypto');

// --- Download Tokens Registry ---
// We use a Map to store short-lived tokens (uuid -> { userId, expiresAt })
const downloadTokens = new Map();
const TOKEN_EXPIRY_MS = 60000; // 1 minute

// Helper to clean up expired tokens periodically
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of downloadTokens.entries()) {
        if (data.expiresAt < now) {
            downloadTokens.delete(token);
        }
    }
}, 60000);

module.exports = {
    generateToken: (userId) => {
        const token = crypto.randomUUID();
        downloadTokens.set(token, {
            userId,
            expiresAt: Date.now() + TOKEN_EXPIRY_MS
        });
        return token;
    },

    validateDownloadToken: (token) => {
        const data = downloadTokens.get(token);
        if (!data) return null;
        if (data.expiresAt < Date.now()) {
            downloadTokens.delete(token);
            return null;
        }
        // single-use token - immediately delete it
        downloadTokens.delete(token);
        return data.userId;
    }
};
