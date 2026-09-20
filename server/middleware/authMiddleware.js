/**
 * Yankiii Barber Co. — JWT Authentication Middleware
 * Validates bearer token and attaches decoded user to request.
 */

const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured.');
}

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: 'Authentication token is required.'
        });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({
            success: false,
            message: 'Invalid authorization token format. Use: Bearer <token>'
        });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Session expired or invalid token. Please log in again.'
        });
    }
}

// Optional Auth (for guest booking or logged-in booking)
function optionalToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            req.user = jwt.verify(token, JWT_SECRET);
        } catch (e) {
            // Non-blocking: continue as guest
        }
    }
    next();
}

module.exports = {
    verifyToken,
    optionalToken,
    JWT_SECRET
};

